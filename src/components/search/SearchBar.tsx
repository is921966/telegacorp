"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui";
import { X, Search } from "lucide-react";

export function SearchBar() {
  const { isSearchOpen, searchQuery, setSearchQuery, toggleSearch } = useUIStore();

  if (!isSearchOpen) return null;

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2 bg-background">
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search messages..."
        className="border-none bg-transparent p-0 h-8 focus-visible:ring-0"
        autoFocus
      />
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggleSearch}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
