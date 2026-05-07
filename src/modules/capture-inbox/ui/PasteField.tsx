"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button, Input } from "@/lib/ui";

export function PasteField() {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  async function submitCapture() {
    if (!rawInput.trim()) {
      return;
    }

    await fetch("/api/captures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawInput, source: "paste" })
    });
    setRawInput("");
    setStatus("saved");
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input
        aria-label="Paste a Spotify URL or Artist - Track"
        placeholder="Paste a Spotify URL or Artist - Track"
        value={rawInput}
        onChange={(event) => {
          setRawInput(event.target.value);
          setStatus("idle");
        }}
      />
      <Button type="button" variant="accent" onClick={submitCapture} className="w-full sm:w-auto">
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        {status === "saved" ? "Saved" : "Capture"}
      </Button>
    </div>
  );
}
