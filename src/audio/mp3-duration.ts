// Dependency-free MP3 duration reader.
//
// We only need the play length of our own gpt-4o-mini-tts output (and the
// intro stinger) to place chapter markers and record the true episode length.
// Rather than pull in a metadata library (music-metadata v11's lazy,
// dynamic-import parser loading proved flaky under tsx when called from a
// non-entry module), this parses just enough of the MPEG frame headers:
//   • skip a leading ID3v2 tag if present,
//   • read the first audio frame header (version / layer / bitrate / rate),
//   • if it carries a Xing/Info VBR header, use the frame count,
//   • otherwise treat it as CBR and divide the audio byte length by the bitrate.
// Returns 0 if the buffer doesn't look like an MP3.

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000, 0], // MPEG1
  2: [22050, 24000, 16000, 0], // MPEG2
  0: [11025, 12000, 8000, 0],  // MPEG2.5
};

export function mp3DurationSeconds(buf: Buffer): number {
  let offset = 0;

  // Skip an ID3v2 tag: "ID3" + version(2) + flags(1) + syncsafe size(4).
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
    offset = 10 + size;
  }

  // Find frame sync (11 set bits): 0xFF followed by 0xE0-mask.
  while (offset < buf.length - 4) {
    if (buf[offset] === 0xff && (buf[offset + 1] & 0xe0) === 0xe0) break;
    offset++;
  }
  if (offset >= buf.length - 4) return 0;

  const h1 = buf[offset + 1];
  const h2 = buf[offset + 2];
  const h3 = buf[offset + 3];

  const versionBits = (h1 >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
  const layerBits = (h1 >> 1) & 0x03;   // 1 = Layer III
  if (layerBits !== 0x01) return 0;      // we only produce Layer III

  const bitrateIdx = (h2 >> 4) & 0x0f;
  const sampleIdx = (h2 >> 2) & 0x03;
  const channelMode = (h3 >> 6) & 0x03;  // 3 = mono

  const isV1 = versionBits === 3;
  const bitrate = (isV1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIdx] * 1000;
  const sampleRate = (SAMPLE_RATES[versionBits] ?? [])[sampleIdx];
  if (!bitrate || !sampleRate) return 0;

  const samplesPerFrame = isV1 ? 1152 : 576;

  // Look for a Xing/Info VBR header (after the frame header + side info).
  const sideInfo = isV1 ? (channelMode === 3 ? 17 : 32) : (channelMode === 3 ? 9 : 17);
  const xingOff = offset + 4 + sideInfo;
  if (xingOff + 12 <= buf.length) {
    const tag = buf.toString("ascii", xingOff, xingOff + 4);
    if (tag === "Xing" || tag === "Info") {
      const flags = buf.readUInt32BE(xingOff + 4);
      if (flags & 0x01) {
        const frameCount = buf.readUInt32BE(xingOff + 8);
        return (frameCount * samplesPerFrame) / sampleRate;
      }
    }
  }

  // CBR: duration = audio byte length * 8 / bitrate.
  const audioBytes = buf.length - offset;
  return (audioBytes * 8) / bitrate;
}
