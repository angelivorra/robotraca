export class SubtitleEngine {
    constructor() {
        this.cues = [];
    }

    /**
     * Auto-detects SRT or WebVTT format and parses accordingly.
     * Call with the raw file text from either format.
     */
    parse(text) {
        this.cues = [];
        const isSrt = !text.trimStart().startsWith('WEBVTT');
        const normalized = isSrt ? _srtToVtt(text) : text;
        this._parseVtt(normalized);
        return this;
    }

    _parseVtt(text) {
        const lines = text.split(/\r?\n/);
        let i = 0;

        // Skip header / NOTE blocks — jump to first timestamp line
        while (i < lines.length && !lines[i].includes('-->')) i++;

        while (i < lines.length) {
            const line = lines[i].trim();

            if (line.includes('-->')) {
                const arrow    = line.indexOf('-->');
                const startStr = line.slice(0, arrow).trim();
                const endStr   = line.slice(arrow + 3).trim().split(/\s/)[0]; // strip cue settings

                const start = _parseTime(startStr);
                const end   = _parseTime(endStr);

                i++;
                const textLines = [];
                while (i < lines.length && lines[i].trim() !== '') {
                    // Strip inline tags: <b>, <i>, <font color="…">, {…} (SRT curly-brace tags)
                    textLines.push(
                        lines[i].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim()
                    );
                    i++;
                }

                if (textLines.length > 0 && start >= 0 && end > start) {
                    this.cues.push({ start, end, text: textLines.join('\n') });
                }
            }

            i++;
        }
    }

    getCueAt(currentTime) {
        for (const cue of this.cues) {
            if (currentTime >= cue.start && currentTime < cue.end) {
                return cue.text;
            }
        }
        return null;
    }
}

/**
 * Converts SRT text to VTT-compatible text so the same parser handles both.
 * SRT differences:
 *   - Sequence numbers (lines with only digits) between cues
 *   - Comma as millisecond separator: 00:00:01,500 → 00:00:01.500
 */
function _srtToVtt(srt) {
    return srt
        .replace(/\r\n/g, '\n')                         // normalize line endings
        .replace(/^\d+\s*$/gm, '')                      // remove sequence number lines
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); // comma → dot in timestamps
}

// Parses HH:MM:SS.mmm or MM:SS.mmm → seconds (float)
function _parseTime(str) {
    if (!str) return -1;
    const parts = str.split(':');
    try {
        if (parts.length === 3) {
            return parseInt(parts[0], 10) * 3600 +
                   parseInt(parts[1], 10) * 60  +
                   parseFloat(parts[2]);
        }
        if (parts.length === 2) {
            return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
        }
    } catch (_) {}
    return -1;
}
