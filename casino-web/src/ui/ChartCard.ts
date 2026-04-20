// ChartCard.ts — canvas-based line chart, port of ChartCard.gd
export class ChartCard {
  private canvas: HTMLCanvasElement;
  private ctx   : CanvasRenderingContext2D;
  readonly title: string;
  private lineColor: string;

  constructor(parent: HTMLElement, title: string, lineColor: string) {
    this.title     = title;
    this.lineColor = lineColor;

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card';

    const label = document.createElement('div');
    label.className   = 'chart-label';
    label.textContent = title;

    this.canvas        = document.createElement('canvas');
    this.canvas.height = 160;
    // Width set dynamically on first draw

    wrapper.append(label, this.canvas);
    parent.appendChild(wrapper);

    this.ctx = this.canvas.getContext('2d')!;
    this.draw([], []);
  }

  draw(values: number[], days: number[]): void {
    // Sync canvas width to actual rendered width
    const w = this.canvas.offsetWidth || 358;
    const h = 160;
    if (this.canvas.width !== w) this.canvas.width = w;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1c202c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2e3347';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Current value top-right
    if (values.length > 0) {
      const cur  = values[values.length - 1];
      const text = cur < 100 ? cur.toFixed(1) : String(Math.round(cur));
      ctx.fillStyle = '#fff';
      ctx.font      = '12px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(text, w - 6, 18);
    }

    if (values.length === 0) {
      ctx.fillStyle  = '#555';
      ctx.font       = '12px -apple-system, sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('No data yet.', w / 2, h / 2);
      return;
    }

    const mTop    = 26;
    const mBottom = 22;
    const mSide   = 8;
    const cW      = w - mSide * 2;
    const cH      = h - mTop - mBottom;

    if (values.length === 1) {
      const cx = mSide + cW / 2;
      const cy = mTop  + cH / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = this.lineColor;
      ctx.fill();
    } else {
      let yMax = Math.max(...values) * 1.2;
      if (yMax < 1) yMax = 1;

      ctx.strokeStyle = this.lineColor;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      values.forEach((v, i) => {
        const nx = i / (values.length - 1);
        const ny = 1 - v / yMax;
        const x  = mSide + nx * cW;
        const y  = mTop  + ny * cH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Day labels
    if (days.length > 0) {
      ctx.fillStyle = '#555';
      ctx.font      = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Day ${days[0]}`,              mSide,     h - 6);
      ctx.textAlign = 'right';
      ctx.fillText(`Day ${days[days.length - 1]}`, w - mSide, h - 6);
    }
  }
}
