'use client';

import { useRef, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link2, Download, FileDown, CheckCircle2 } from 'lucide-react';

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyUrl: string;
  campaignName: string;
  campaignStartDate?: string;
  campaignEndDate?: string;
  companyName?: string;
  companyLogoUrl?: string;
}

// Brand colors
const NAVY  = '#144660';
const GREEN = '#1ff28d';
const GRAY  = '#ebf0eb';
const MUTED = '#6B7280';
const LIGHT = '#9CA3AF';

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

export function QRCodeModal({
  open,
  onOpenChange,
  surveyUrl,
  campaignName,
}: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [surveyUrl]);

  const handleDownloadPng = useCallback(() => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `qrcode-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [campaignName]);

  const handleDownloadPdf = useCallback(() => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute('width', '300');
    svgClone.setAttribute('height', '300');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code — ${campaignName}</title>
          <style>
            @media print { @page { margin: 0; } }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: #fff; }
            .header { background: ${NAVY}; width: 100%; padding: 24px 40px 20px; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
            .logo-main { color: #fff; }
            .logo-360 { color: ${GREEN}; }
            .subtitle { color: rgba(255,255,255,0.65); font-size: 13px; margin-top: 4px; }
            .body { padding: 32px 40px; display: flex; flex-direction: column; align-items: center; }
            h2 { font-size: 17px; color: ${NAVY}; margin: 0 0 4px; text-align: center; }
            p { font-size: 12px; color: ${MUTED}; margin: 4px 0; word-break: break-all; max-width: 300px; text-align: center; }
            .accent-bar { height: 4px; background: ${GREEN}; width: 100%; }
            .footer { background: ${NAVY}; width: 100%; padding: 12px; text-align: center;
                      font-size: 11px; color: rgba(255,255,255,0.5); }
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
            <p style="margin-top:16px;color:${LIGHT};">${surveyUrl}</p>
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

  // Card download — not exposed in UI, kept for future use
  const _handleDownloadCard = useCallback(async () => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    const W = 560;
    const H = 800;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, 140);

    ctx.font = 'bold 46px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Vivamente', 40, 82);
    const vivW = ctx.measureText('Vivamente').width;
    ctx.fillStyle = GREEN;
    ctx.fillText('360', 40 + vivW, 82);

    ctx.font = '15px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('Mapeamento de Riscos Psicossociais', 40, 112);

    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 140, W, 5);

    const qrBoxSize = 340;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 175;

    ctx.save();
    ctx.shadowColor = 'rgba(20,70,96,0.12)';
    ctx.shadowBlur  = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 18);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = NAVY;

    const maxW = W - 80;
    let name = campaignName;
    if (ctx.measureText(name).width > maxW) {
      while (ctx.measureText(name + '…').width > maxW && name.length > 1)
        name = name.slice(0, -1);
      name += '…';
    }
    ctx.fillText(name, W / 2, qrBoxY + qrBoxSize + 44);

    ctx.font = '14px Arial, Helvetica, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('Escaneie o QR Code para participar', W / 2, qrBoxY + qrBoxSize + 70);

    ctx.beginPath();
    ctx.strokeStyle = GRAY;
    ctx.lineWidth = 1;
    ctx.moveTo(40, qrBoxY + qrBoxSize + 94);
    ctx.lineTo(W - 40, qrBoxY + qrBoxSize + 94);
    ctx.stroke();

    ctx.font = '11px Arial, Helvetica, sans-serif';
    ctx.fillStyle = LIGHT;
    let urlText = surveyUrl;
    const maxUrlW = W - 80;
    while (ctx.measureText(urlText).width > maxUrlW && urlText.length > 20)
      urlText = urlText.slice(0, -1);
    if (urlText !== surveyUrl) urlText += '…';
    ctx.fillText(urlText, W / 2, qrBoxY + qrBoxSize + 118);

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, H - 56, W, 56);
    ctx.font = '12px Arial, Helvetica, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Vivamente360 — Plataforma de Riscos Psicossociais NR-1', W / 2, H - 22);

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

  void _handleDownloadCard; // retained for future use

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code da Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="py-1">
          <p className="text-xs text-muted-foreground mb-3">Preview do Card</p>

          <div className="flex gap-4 items-stretch">
            {/* Left — card preview */}
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-sm bg-white">
                {/* Top-right decorative triangle */}
                <div
                  className="absolute top-0 right-0 w-14 h-14 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, transparent 50%, #16a34a 50%)' }}
                />
                {/* Bottom-left decorative triangle */}
                <div
                  className="absolute bottom-0 left-0 w-14 h-14 pointer-events-none"
                  style={{ background: 'linear-gradient(315deg, transparent 50%, #16a34a 50%)' }}
                />

                {/* QR code */}
                <div className="flex items-center justify-center px-5 pt-6 pb-4">
                  <div ref={qrRef} className="p-2 bg-white rounded-md border border-gray-200 shadow-sm">
                    <QRCodeSVG
                      value={surveyUrl}
                      size={130}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                </div>

                {/* Branding */}
                <div className="px-3 pb-3 flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">Vivamente</span>
                  <span className="text-xs font-bold text-green-600">360</span>
                </div>
              </div>

              {/* URL below card */}
              <p className="text-[10px] text-muted-foreground text-center break-all px-1 mt-2 leading-tight">
                {surveyUrl}
              </p>
            </div>

            {/* Right — action buttons */}
            <div className="flex flex-col gap-2.5 w-[140px] shrink-0">
              <Button
                className="w-full h-16 flex-col gap-1 text-xs font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#1B6157' }}
                onClick={handleCopyLink}
              >
                {copied ? <CheckCircle2 className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
              </Button>

              <Button
                className="w-full h-16 flex-col gap-1 text-xs font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#1B6157' }}
                onClick={handleDownloadPng}
              >
                <Download className="h-5 w-5" />
                <span>Baixar PNG</span>
              </Button>

              <Button
                className="w-full h-16 flex-col gap-1 text-xs font-semibold rounded-xl text-white"
                style={{ backgroundColor: '#16a34a' }}
                onClick={handleDownloadPdf}
              >
                <FileDown className="h-5 w-5" />
                <span className="text-center leading-tight">Baixar PDF para Impressão</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
