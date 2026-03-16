import asyncio
import json
import os
import warnings
import logging

warnings.simplefilter("ignore")
import audioop
import traceback
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Initialize Google GenAI Client
client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"), http_options={"api_version": "v1alpha"})

# Registry to track pending tool responses
pending_tools: Dict[str, asyncio.Future] = {}

async def relay_tool_to_client(websocket: WebSocket, tool_call: types.LiveServerToolCall) -> list[types.FunctionResponse]:
    responses = []
    for fc in tool_call.function_calls:
        call_id = fc.id
        future = asyncio.get_event_loop().create_future()
        pending_tools[call_id] = future

        logger.info(f"DEBUG: [TOOL CALL] {fc.name} (ID: {call_id})")
        await websocket.send_text(json.dumps({"type": "tool_call", "id": call_id, "name": fc.name, "args": fc.args}))

        try:
            result = await asyncio.wait_for(future, timeout=30.0)
            logger.info(f"DEBUG: [TOOL RESPONSE] {fc.name} -> Success")
            responses.append(types.FunctionResponse(id=call_id, name=fc.name, response=result))
        except asyncio.TimeoutError:
            logger.warning(f"DEBUG: [TOOL TIMEOUT] {fc.name}")
            responses.append(types.FunctionResponse(id=call_id, name=fc.name, response={"error": "timeout"}))
        finally:
            pending_tools.pop(call_id, None)
    return responses

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("DEBUG: Client connected via WebSocket.")

    audio_input_queue = asyncio.Queue()
    text_input_queue = asyncio.Queue()

    tools = [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="navigate_to_url",
                    description="Navigate the browser to a specific URL",
                    parameters={
                        "type": "OBJECT",
                        "properties": {"url": {"type": "STRING", "description": "The URL to open"}},
                        "required": ["url"]
                    }
                )
            ]
        )
    ]

    model_id = "gemini-2.5-flash-native-audio-preview-12-2025"

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Puck"
                )
            )
        ),
        system_instruction=types.Content(parts=[types.Part(text="You are a senior browser assistant. If asked to open a site, use navigate_to_url immediately. Acknowledge what you are doing.")]),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        proactivity=types.ProactivityConfig(proactive_audio=True),
        enable_affective_dialog=True,
        tools=tools,
    )

    try:
        async with client.aio.live.connect(model=model_id, config=config) as session:
            logger.info(f"DEBUG: Session with {model_id} established.")

            async def send_audio():
                try:
                    while True:
                        chunk = await audio_input_queue.get()
                        await session.send_realtime_input(
                            audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                        )
                except asyncio.CancelledError:
                    pass

            async def send_text():
                try:
                    while True:
                        text = await text_input_queue.get()
                        logger.info(f"DEBUG: Sending text to Gemini: {text}")
                        await session.send_realtime_input(text=text)
                except asyncio.CancelledError:
                    pass

            async def receive_from_client():
                try:
                    while True:
                        message = await websocket.receive()
                        if "bytes" in message:
                            await audio_input_queue.put(message["bytes"])
                        elif "text" in message:
                            msg = json.loads(message["text"])
                            if msg.get("type") == "tool_response":
                                call_id = msg.get("id")
                                if call_id in pending_tools:
                                    pending_tools[call_id].set_result(msg.get("result"))
                            elif msg.get("type") == "text":
                                logger.info(f"DEBUG: [USER TEXT] {msg.get('text')}")
                                await text_input_queue.put(msg.get("text"))
                except WebSocketDisconnect:
                    logger.info("DEBUG: WebSocket disconnected")
                except Exception as e:
                    logger.error(f"ERROR: receive_from_client: {e}")

            async def gemini_to_electron():
                try:
                    async for message in session.receive():
                        server_content = message.server_content
                        tool_call = message.tool_call
                        
                        if server_content:
                            if server_content.model_turn:
                                for part in server_content.model_turn.parts:
                                    if part.inline_data:
                                        await websocket.send_bytes(part.inline_data.data)
                                    if part.text:
                                        logger.info(f"DEBUG: [GEMINI TEXT] {part.text}")
                                        await websocket.send_text(json.dumps({"type": "text", "text": part.text}))
                            
                            if server_content.input_transcription and server_content.input_transcription.text:
                                logger.info(f"DEBUG: [USER HEARD] {server_content.input_transcription.text}")
                                await websocket.send_text(json.dumps({"type": "transcription", "text": server_content.input_transcription.text}))
                            
                            if server_content.turn_complete:
                                await websocket.send_text(json.dumps({"type": "turn_complete"}))
                            
                            if server_content.interrupted:
                                await websocket.send_text(json.dumps({"type": "interrupted"}))

                        if tool_call:
                            logger.info(f"DEBUG: [TOOL REQUESTED] {tool_call}")
                            responses = await relay_tool_to_client(websocket, tool_call)
                            await session.send_tool_response(function_responses=responses)

                except Exception as e:
                    logger.error(f"ERROR: gemini_to_electron: {e}")

            send_audio_task = asyncio.create_task(send_audio())
            send_text_task = asyncio.create_task(send_text())
            receive_task = asyncio.create_task(receive_from_client())
            
            await gemini_to_electron()

    except Exception as e:
        logger.error(f"FATAL: {e}")
        traceback.print_exc()
    finally:
        try:
            send_audio_task.cancel()
            send_text_task.cancel()
            receive_task.cancel()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
