import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const getPages = () => {
    const pages: (number | "ellipsis")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push("ellipsis")
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis")
      pages.push(totalPages)
    }
    return pages
  }

  if (totalPages <= 1) return null

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} role="navigation" aria-label="pagination">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      {getPages().map((page, i) =>
        page === "ellipsis" ? (
          <span key={`e${i}`} className="flex h-7 w-7 items-center justify-center">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7 text-xs"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </nav>
  )
}
