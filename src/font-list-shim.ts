// Browser-compatible shim for font-list
// In Obsidian/Electron environment, we can't use the native font-list module
// which relies on child_process

export async function getFonts(): Promise<string[]> {
    // Return empty array - the actual font detection will be done by CSS
    // or we could try to use Electron's remote module if available
    try {
        // Attempt to use queryLocalFonts API if available (browser API)
        if ('queryLocalFonts' in window) {
            // @ts-ignore - queryLocalFonts is experimental
            const fonts = await window.queryLocalFonts();
            return fonts.map((font: any) => font.family);
        }
    } catch (e) {
        console.warn('Could not query local fonts:', e);
    }

    // Fallback: return an empty array
    // Font validation will still work via CSS in fontValidator.ts
    return [];
}
