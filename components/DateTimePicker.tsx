"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export default function DateTimePicker({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const timeValue = value
    ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    : "";

  function handleSelectDate(date: Date | undefined) {
    if (!date) return;
    const merged = new Date(date);
    if (value) {
      merged.setHours(value.getHours(), value.getMinutes(), 0, 0);
    } else {
      merged.setHours(12, 0, 0, 0);
    }
    onChange(merged);
    setOpen(false);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!value) return;
    const [h, m] = e.target.value.split(":").map(Number);
    const merged = new Date(value);
    merged.setHours(h, m, 0, 0);
    onChange(merged);
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" variant="outline" className="flex-1 justify-start font-normal" />}
        >
          <CalendarIcon className="size-4" />
          {value
            ? value.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
            : "Pick a date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleSelectDate}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timeValue}
        onChange={handleTimeChange}
        disabled={!value}
        className="w-28"
        placeholder="--:--"
      />
    </div>
  );
}
