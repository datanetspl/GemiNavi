# GemiNavi Live Assistant

GemiNavi Live Assistant is a desktop application that integrates Google's **Gemini Multimodal Live API** with a custom Electron-based browser controller. This allows for real-time interaction via voice, text, and visual feedback, enabling the agent to perform actions such as navigating websites, taking screenshots, and interacting with browser elements based on your instructions.

## Architecture

The application is split into three main parts:
- **Backend (Python/FastAPI)**: Acts as a secure relay between the desktop application and the Google GenAI Multimodal Live API. It handles WebSocket connections, manages media streams, and routes tool calls from Gemini.
- **Main Process (Electron/Node.js)**: Manages the application lifecycle, IPC (Inter-Process Communication), and provides access to system-level features like screen capturing and browser control.
- **Renderer Process (Client/UI)**: The frontend user interface that captures microphone and camera input, displays the conversation status, and executes "tools" (like navigating or clicking) by communicating with the Main process.

![Architecture Diagram](architecture-diagram.svg)

---

## Prerequisites

Before starting, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Python](https://www.python.org/) (v3.9 or newer)
- A **Google Gemini API Key** (v1alpha / experimental access required for Multimodal Live)

---

## Getting Started

Follow these steps to set up and run the application.

### 1. Set Up the Backend

The backend acts as the bridge between your client and Gemini.

1.  Navigate to the `backend/` directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On Mac/Linux:
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure your environment variables:
    Create a `.env` file in the `backend/` directory and add your Google API Key:
    ```bash
    GOOGLE_API_KEY=your_gemini_api_key_here
    ```

### 2. Set Up the Frontend (Electron)

The frontend is the desktop app interface.

1.  Navigate to the project root directory:
    ```bash
    cd ..
    ```
2.  Install the required Node.js packages:
    ```bash
    npm install
    ```

---

## Running the Application

To run the full system, you need to have both the backend and the frontend running simultaneously.

### Step 1: Start the Backend
From the `backend/` directory, run the following command:
```bash
python main.py
```
By default, the backend will start a WebSocket server at `ws://localhost:8000/ws`.

### Step 2: Start the Electron App
From the root directory, open a new terminal and run:
```bash
npm start
```

Once both are running, the application window will appear. You can start interacting with Gemini via voice or text!

---

## Features & Capabilities

- **Real-time Voice Interaction**: Speak directly with Gemini and receive low-latency audio responses.
- **Multimodal Feedback**: Gemini can "see" your screen and respond based on what’s happening in real-time.
- **Browser Automation**: Ask Gemini to:
  - "Open Google and search for the latest tech news"
  - "Click on the first result"
  - "Scroll down the page"
  - "Tell me what's on my screen"
- **Tool Integration**: The application includes a suite of tools for navigation, element interaction, and script execution.

---

## Configuration

The application can be configured through several files:
- **`backend/.env`**: Stores the `GOOGLE_API_KEY`.
- **`client/js/config/config.js`**: Client-side settings for WebSocket URLs and media constraints.
- **`package.json`**: Electron build and startup scripts.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
