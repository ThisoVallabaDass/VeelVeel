class VeelCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(2048);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    let sourceOffset = 0;
    while (sourceOffset < input.length) {
      const count = Math.min(input.length - sourceOffset, this.pending.length - this.offset);
      this.pending.set(input.subarray(sourceOffset, sourceOffset + count), this.offset);
      sourceOffset += count; this.offset += count;
      if (this.offset === this.pending.length) {
        const packet = this.pending;
        this.pending = new Float32Array(2048); this.offset = 0;
        this.port.postMessage(packet, [packet.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('veel-capture', VeelCapture);
