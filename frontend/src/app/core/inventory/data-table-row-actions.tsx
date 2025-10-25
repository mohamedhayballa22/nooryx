"use client"

import Link from "next/link"
import { Row } from "@tanstack/react-table"
import { EllipsisIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Product } from "./columns"

interface DataTableRowActionsProps {
  row: Row<Product>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const product = row.original

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <EllipsisIcon className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[160px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem asChild>
          <Link href={`/core/inventory?sku=${encodeURIComponent(product.sku_code)}`}>See more</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/core/audit-trail?search=${product.sku_code}`}>View History</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
