'use client';

import { useRef, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Printer, Copy, CheckCircle2 } from 'lucide-react';

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
  const [generatingCard, setGeneratingCard] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [surveyUrl]);

  const handleDownloadQr = useCallback(() => {
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

  const handlePrint = useCallback(() => {
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

  const handleDownloadCard = useCallback(async () => {
    if (!qrRef.current) return;
    const svgEl = qrRef.current.querySelector('svg');
    if (!svgEl) return;

    setGeneratingCard(true);
    try {
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
        link.download = `card-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      img.src = url;
    } finally {
      setGeneratingCard(false);
    }
  }, [campaignName, surveyUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Acesso à Pesquisa</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-1">
          {/* QR Code card with shadow */}
          <div
            ref={qrRef}
            className="p-5 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center gap-3 w-full"
          >
            <QRCodeSVG
              value={surveyUrl}
              size={220}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: '/logo.png',
                height: 36,
                width: 90,
                excavate: true,
              }}
            />
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold" style={{ color: NAVY }}>Vivamente</span>
              <span className="text-xs font-bold" style={{ color: '#16a34a' }}>360</span>
            </div>
          </div>

          {/* Link field + copy button */}
          <div className="w-full space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Link Curto</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={surveyUrl}
                className="text-xs h-9 select-all"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="shrink-0 h-9 px-3 gap-1.5"
              >
                {copied
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  : <Copy className="h-3.5 w-3.5" />}
                <span className="text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          {/* Primary — download QR */}
          <Button
            className="w-full h-11 text-sm font-semibold text-white gap-2"
            style={{ backgroundColor: '#22c55e' }}
            onClick={handleDownloadQr}
          >
            <Download className="h-4 w-4" />
            Baixar QR Code
          </Button>

          {/* Secondary — print + card */}
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm gap-2"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm gap-2"
              onClick={handleDownloadCard}
              disabled={generatingCard}
            >
              <Download className="h-4 w-4" />
              {generatingCard ? 'Gerando...' : 'Baixar Card de Divulgação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
