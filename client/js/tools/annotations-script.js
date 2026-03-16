/**
 * This script is injected into the browser window to find and label interactive elements.
 */
export const ANNOTATIONS_SCRIPT = `
(function() {
    // Remove existing labels
    const existingContainer = document.getElementById('gemini-annotations-container');
    if (existingContainer) {
        existingContainer.remove();
    }

    const container = document.createElement('div');
    container.id = 'gemini-annotations-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '2147483647';
    document.body.appendChild(container);

    const interactiveSelectors = [
        'a', 'button', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="menuitem"]',
        'summary', '[onclick]'
    ];

    const elements = Array.from(document.querySelectorAll(interactiveSelectors.join(',')));
    const visibleElements = elements.filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
        );
    });

    const labels = visibleElements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const labelId = index + 1;
        
        const label = document.createElement('div');
        label.textContent = labelId;
        label.style.position = 'fixed';
        label.style.top = (rect.top + window.scrollY) + 'px';
        label.style.left = (rect.left + window.scrollX) + 'px';
        label.style.background = 'rgba(255, 255, 0, 0.9)';
        label.style.color = 'black';
        label.style.padding = '2px 5px';
        label.style.borderRadius = '3px';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.border = '1px solid black';
        label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        label.style.zIndex = '2147483647';
        label.style.pointerEvents = 'auto'; // Allow clicking labels too? Maybe not.
        
        // Add a class to find it later
        el.classList.add('gemini-target-' + labelId);
        el.setAttribute('data-gemini-label', labelId);

        container.appendChild(label);

        return {
            labelId: labelId,
            text: el.innerText || el.ariaLabel || el.placeholder || el.value || '',
            tagName: el.tagName,
            role: el.getAttribute('role') || el.type || ''
        };
    });

    return labels;
})()
`;
