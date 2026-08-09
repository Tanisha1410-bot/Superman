interface ParsedToolCall {
    name: string;
    args: Record<string, any>;
}

const KNOWN_TOOLS = ['send_email', 'create_event'];

export function parseFallbackToolCall(text: string): ParsedToolCall | null {
    if (!text) return null;

    let bestMatch: { name: string; index: number } | null = null;
    for (const tool of KNOWN_TOOLS) {
        const idx = text.indexOf(tool);
        if (idx !== -1 && (bestMatch === null || idx < bestMatch.index)) {
            bestMatch = { name: tool, index: idx };
        }
    }
    if (!bestMatch) return null;

    const startBrace = text.indexOf('{', bestMatch.index);
    if (startBrace === -1) return null;

    let depth = 0;
    let endBrace = -1;
    for (let i = startBrace; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) {
                endBrace = i;
                break;
            }
        }
    }
    if (endBrace === -1) return null;

    const jsonStr = text.slice(startBrace, endBrace + 1);
    try {
        const args = JSON.parse(jsonStr);
        return { name: bestMatch.name, args };
    } catch (e) {
        console.error('Fallback tool call JSON parse failed:', e, jsonStr);
        return null;
    }
}