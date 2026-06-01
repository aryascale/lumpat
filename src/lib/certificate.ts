export type CertData = {
    eventId?: string;
    eventName?: string;
    name: string;
    bib: string;
    gender: string;
    category: string;
    ageCategory?: string;
    finishTime: string;
    totalTimeDisplay: string;
    overallRank?: number | null;
    genderRank?: number | null;
    categoryRank?: number | null;
    ageRank?: number | null;
  };

  export async function renderCertificatePNG(data: CertData): Promise<string> {
    const W = 1080;
    const H = 1920;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) throw new Error("Canvas not supported");

    try {
      let bgUrl: string | null = null;
      
      console.log("Certificate Generation - eventId:", data.eventId);

      // Try to get custom event-specific certificate if eventId is provided
      if (data.eventId) {
        try {
          const res = await fetch(`/api/certificate?eventId=${data.eventId}`);
          console.log("Certificate API Response OK:", res.ok);
          if (res.ok) {
            const result = await res.json();
            console.log("Certificate API Result:", result);
            if (result.hasCertificate && result.files && result.files.length > 0) {
              // Add a cache buster so changes on admin panel are immediately reflected
              bgUrl = result.files[0].url + "?t=" + Date.now();
              console.log("Using custom bgUrl:", bgUrl);
            }
          }
        } catch (err) {
          console.error("Failed to fetch custom certificate info:", err);
        }
      }

      if (!bgUrl) {
        throw new Error("Belum ada template");
      }

      console.log("Loading Image from:", bgUrl);
      const bg = await loadImage(bgUrl);
      
      // Implement object-fit: cover logic to prevent stretching
      const canvasRatio = W / H;
      const bgRatio = bg.width / bg.height;
      let drawW, drawH, drawX, drawY;

      if (bgRatio > canvasRatio) {
        // Background is wider than canvas -> match height, crop width
        drawH = H;
        drawW = bg.width * (H / bg.height);
        drawX = (W - drawW) / 2;
        drawY = 0;
      } else {
        // Background is taller than canvas -> match width, crop height
        drawW = W;
        drawH = bg.height * (W / bg.width);
        drawX = 0;
        drawY = (H - drawH) / 2;
      }

      ctx.drawImage(bg, drawX, drawY, drawW, drawH);
    } catch (err: any) {
      console.error("Browser anda error");
      // Propagate the error so the UI can show a notification
      throw new Error(err.message === "Belum ada template" ? err.message : "Gagal memuat template sertifikat");
    }

    const centerX = W / 2;

    const drawCenter = (
      text: string,
      y: number,
      size = 56,
      color = "#0f172a",
      weight = "700"
    ) => {
      ctx.font = `${weight} ${size}px Roboto, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, centerX, y);
    };

    // Header
    drawCenter("E-CERTIFICATE FINISHER", 640, 42, "#475569", "800");

    // Participant Name
    drawCenter(data.name || "-", 760, 72, "#0f172a", "900");

    // Elegant separator line below name
    ctx.beginPath();
    ctx.moveTo(centerX - 380, 810);
    ctx.lineTo(centerX + 380, 810);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();

    // Subtitles
    drawCenter("Have joined and successfully finished", 880, 32, "#64748b", "500");
    drawCenter(`${data.eventName || 'The Event'} with official result as follow:`, 930, 32, "#64748b", "500");

    // Data rows
    const rows: Array<[string, string]> = [
      ["BIB Number", data.bib || "-"],
      ["Distance", data.category || "-"],
      ["Gender", data.gender || "-"],
      ["Age Category", data.ageCategory?.trim() || "-"],
      ["Total Time", data.totalTimeDisplay || "-"],
      ["Overall Rank", data.overallRank != null ? `${data.overallRank}` : "-"],
      [`Rank in ${data.category || 'Distance'}`, data.categoryRank != null ? `${data.categoryRank}` : "-"],
      [`Rank in ${data.gender || 'Gender'}`, data.genderRank != null ? `${data.genderRank}` : "-"],
    ];

    if (data.ageCategory && data.ageCategory.trim().length > 0 && data.ageCategory.trim() !== "-") {
      rows.push([`Rank in ${data.ageCategory.trim()}`, data.ageRank != null ? `${data.ageRank}` : "-"]);
    }

    const startY = 980;
    const rowH = 54;
    
    // Draw borderless semi-transparent section background
    const sectionW = 860;
    const sectionX = (W - sectionW) / 2;
    const sectionY = startY - 40;
    const sectionH = rows.length * rowH + 80;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    roundRect(ctx, sectionX, sectionY, sectionW, sectionH, 24);
    ctx.fill();

    for (let i = 0; i < rows.length; i++) {
      const [label, value] = rows[i];
      const y = startY + i * rowH + (rowH / 2); // vertically center in row
      
      // Label
      ctx.font = `600 32px Roboto, sans-serif`;
      ctx.fillStyle = "#475569";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(label, centerX - 30, y);
      
      // Colon
      ctx.font = `600 32px Roboto, sans-serif`;
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(":", centerX, y - 2);
      
      // Value
      ctx.font = `800 34px Roboto, sans-serif`;
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(value, centerX + 30, y);
    }

    const tableBottomY = sectionY + sectionH;
    const footerY = Math.min(tableBottomY + 80, H - 100);
    
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 28px Roboto, sans-serif`;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Timing by IZT Race Technology", centerX, footerY);

    return canvas.toDataURL("image/png");
  }

  // Kept for backward compatibility if needed elsewhere, 
  // though we no longer use it in renderCertificatePNG
  export function drawCenteredTable(
    ctx: CanvasRenderingContext2D,
    opts: { y: number; w: number; rowH: number; rows: Array<[string, string]> }
  ): number {
    const { y, w, rowH, rows } = opts;
    const W = ctx.canvas.width;
    const x = (W - w) / 2;
    const h = rowH * rows.length;
    const r = 16;

    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();

    for (let i = 0; i < rows.length; i++) {
      const ry = y + i * rowH;

      if (i % 2 === 1) {
        ctx.fillStyle = "rgba(241,245,249,0.9)";
        ctx.fillRect(x, ry, w, rowH);
      }

      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(x, ry);
        ctx.lineTo(x + w, ry);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
  
      const [label, value] = rows[i];
      ctx.font = `700 36px Roboto, sans-serif`;
      ctx.fillStyle = "#0f172a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${label}: ${value}`, x + w / 2, ry + rowH / 2);
    }
  
    return y + h;
  }
  
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  
  async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  
  export function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  
