interface ParsedToolCall {
    name: string;
    args: Record<string, any>;
}

export function parseFallbackToolCall(text: string): ParsedToolCall | null {
    // Handles all observed Groq/Llama text-leak formats:
    //   <function/name{...}></function>
    //   <function=name{...}></function>
    //   <function=name {...}>              <- no closing tag, space before JSON
    //   <function name>{...}</function>
    const patterns = [
        /<function[=\/]\s*([a-zA-Z_]+)\s*(\{[\s\S]*?\})\s*(?:<\/function>)?/,
        /<function\s+([a-zA-Z_]+)\s*>\s*(\{[\s\S]*?\})\s*(?:<\/function>)?/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const name = match[1];
                const args = JSON.parse(match[2]);
                return { name, args };
            } catch (e) {
                console.error('Fallback tool call JSON parse failed:', e);
                return null;
            }
        }
    }
    return null;
}