// ChartCard.ts — canvas-based line chart with DOM-rendered title + current
// value. The current value used to be painted inside the canvas; moving it
// to a real <span> means it can carry units (€, %), wrap correctly on
// narrow screens, and be selectable.

export type ChartValueFmt = (v: number) => string;

export class ChartCard {
  private canvas: HTMLCanvasElement;
  private ctx   : CanvasRenderingContext2D;
  private valueEl: HTMLSpanElement;
  readonly title: string;
  private lineColor: string;
  private fmtValue: ChartValueFmt;

  constructor(
    parent: HTMLElement,
    title: string,
    lineColor: string,
    fmtValue: ChartValueFmt = (v) => (v < 100 ? v.toFixed(1) : String(Math.round(v))),
  ) {
    this.title     = title;
    this.lineColor = lineColor;
    this.fmtValue  = fmtValue;

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card';

    const head = document.createElement('div');
    head.className = 'chart-head';

    const label = document.createElement('div');
    label.className   = 'chart-label';
    label.textContent = title;

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'chart-value';
    this.valueEl.textContent = '—';

    head.append(label, this.valueEl);

    this.canvas        = document.createElement('canvas');
    this.canvas.height = 160;
    // Width set dynamically on first draw

    wrapper.append(head, this.canvas);
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

    // Current value goes to the DOM header span, not into the canvas.
    if (values.length > 0) {
      this.valueEl.textContent = this.fmtValue(values[values.length - 1]);
    } else {
      this.valueEl.textContent = '—';
    }

    if (values.length === 0) {
      ctx.fillStyle  = '#555';
      ctx.font       = '12px -apple-system, sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('No data yet.', w / 2, h / 2);
      return;
    }

    const mTop    = 14;
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
