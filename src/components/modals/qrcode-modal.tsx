'use client';

import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Printer, Download, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyUrl: string;
  campaignName: string;
}

// DNV brand colors
const NAVY   = '#144660';
const GREEN  = '#1ff28d';
const GRAY   = '#ebf0eb';
const MUTED  = '#6B7280';
const LIGHT  = '#9CA3AF';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function QRCodeModal({ open, onOpenChange, surveyUrl, campaignName }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [surveyUrl]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !qrRef.current) return;

    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', '300');
    svgClone.setAttribute('height', '300');

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code — ${campaignName}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; min-height: 100vh; font-family: Arial, sans-serif; background: #fff; }
            .header { background: ${NAVY}; width: 100%; padding: 24px 40px 20px; box-sizing: border-box; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
            .logo-main { color: #fff; }
            .logo-360 { color: ${GREEN}; }
            .subtitle { color: rgba(255,255,255,0.65); font-size: 13px; margin-top: 4px; }
            .body { padding: 32px 40px; display: flex; flex-direction: column; align-items: center; }
            h2 { font-size: 17px; color: ${NAVY}; margin: 0 0 4px; text-align: center; }
            p  { font-size: 12px; color: ${MUTED}; margin: 4px 0; word-break: break-all; max-width: 300px; text-align: center; }
            .footer { background: ${NAVY}; width: 100%; padding: 12px; text-align: center;
                      font-size: 11px; color: rgba(255,255,255,0.5); }
            .accent-bar { height: 4px; background: ${GREEN}; width: 100%; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
              <span class="logo-main">Vivamente</span><span class="logo-360">360</span>
            </div>
            <div class="subtitle">Mapeamento de Riscos Psicossociais</div>
          </div>
          <div class="body">
            <h2>${campaignName}</h2>
            <p style="margin-bottom:16px;color:${MUTED}">Escaneie o QR Code para participar</p>
            ${svgClone.outerHTML}
            <p style="margin-top: 16px; color:${LIGHT};">${surveyUrl}</p>
          </div>
          <div class="accent-bar"></div>
          <div class="footer">Vivamente360 — Plataforma de Riscos Psicossociais NR-1</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, [campaignName, surveyUrl]);

  const handleDownload = useCallback(() => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    // Card dimensions
    const W = 560;
    const H = 800;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Background ────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ── Top header band ───────────────────────────────────────────
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, 140);

    // Logo: "Vivamente" (white) + "360" (green)
    ctx.font = 'bold 46px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Vivamente', 40, 82);
    const vivW = ctx.measureText('Vivamente').width;
    ctx.fillStyle = GREEN;
    ctx.fillText('360', 40 + vivW, 82);

    // Subtitle
    ctx.font = '15px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Mapeamento de Riscos Psicossociais', 40, 112);

    // ── Green accent bar ──────────────────────────────────────────
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 140, W, 5);

    // ── QR code card (white rounded box with shadow) ──────────────
    const qrBoxSize = 340;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 175;

    // shadow
    ctx.save();
    ctx.shadowColor = 'rgba(20,70,96,0.12)';
    ctx.shadowBlur  = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
    ctx.fill();
    ctx.restore();

    // ── Campaign name ─────────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = NAVY;

    // Wrap long names
    const maxW = W - 80;
    let name = campaignName;
    if (ctx.measureText(name).width > maxW) {
      while (ctx.measureText(name + '…').width > maxW && name.length > 1)
        name = name.slice(0, -1);
      name += '…';
    }
    ctx.fillText(name, W / 2, qrBoxY + qrBoxSize + 44);

    // ── "Escaneie" label ──────────────────────────────────────────
    ctx.font = '14px Arial, Helvetica, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('Escaneie o QR Code para participar', W / 2, qrBoxY + qrBoxSize + 70);

    // ── Divider ───────────────────────────────────────────────────
    ctx.beginPath();
    ctx.strokeStyle = GRAY;
    ctx.lineWidth = 1;
    ctx.moveTo(40, qrBoxY + qrBoxSize + 94);
    ctx.lineTo(W - 40, qrBoxY + qrBoxSize + 94);
    ctx.stroke();

    // ── URL text ──────────────────────────────────────────────────
    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.fillStyle = LIGHT;
    let urlText = surveyUrl;
    const maxUrlW = W - 80;
    while (ctx.measureText(urlText).width > maxUrlW && urlText.length > 20)
      urlText = urlText.slice(0, -1);
    if (urlText !== surveyUrl) urlText += '…';
    ctx.fillText(urlText, W / 2, qrBoxY + qrBoxSize + 118);

    // ── Bottom footer band ────────────────────────────────────────
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, H - 56, W, 56);
    ctx.font = '12px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Vivamente360 — Plataforma de Riscos Psicossociais NR-1', W / 2, H - 22);

    // ── Draw QR SVG into the box ──────────────────────────────────
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const pad = 30;
      ctx.drawImage(img, qrBoxX + pad, qrBoxY + pad, qrBoxSize - pad * 2, qrBoxSize - pad * 2);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `qrcode-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [campaignName, surveyUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code da Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-2">
          {/* QR Code preview */}
          <div ref={qrRef} className="p-4 bg-white rounded-xl border shadow-sm">
            <QRCodeSVG
              value={surveyUrl}
              size={220}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* URL display */}
          <p className="text-xs text-muted-foreground text-center break-all px-2 max-w-xs">
            {surveyUrl}
          </p>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyLink}
            >
              {copied ? (
                <><CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />Copiado!</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" />Copiar link</>
              )}
            </Button>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
