"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ShareLinkActions({ joinUrl, title }: { joinUrl: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const waText = encodeURIComponent(`Join my group buy "${title}": ${joinUrl}`);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can be denied by the browser — not fatal
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        {copied ? "Copied ✓" : "Copy link"}
      </Button>
      <Button
        size="sm"
        nativeButton={false}
        render={<a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" />}
      >
        Share to WhatsApp
      </Button>
    </div>
  );
}
