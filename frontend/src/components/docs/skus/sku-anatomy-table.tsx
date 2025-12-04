'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function SKUAnatomyTable() {
  return (
    <div className="not-prose my-8">
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50 dark:bg-neutral-900/50">
              <TableHead className="font-semibold">Field</TableHead>
              <TableHead className="font-semibold">Purpose</TableHead>
              <TableHead className="font-semibold text-center">Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
              <TableCell className="font-mono text-sm font-medium">Code</TableCell>
              <TableCell className="text-neutral-600 dark:text-neutral-400">
                Unique identifier for this product
              </TableCell>
              <TableCell className="text-center">
                Yes
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
              <TableCell className="font-mono text-sm font-medium">Name</TableCell>
              <TableCell className="text-neutral-600 dark:text-neutral-400">
                Human-readable product description
              </TableCell>
              <TableCell className="text-center">
                Yes
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
              <TableCell className="font-mono text-sm font-medium">Low Stock Threshold</TableCell>
              <TableCell className="text-neutral-600 dark:text-neutral-400">
                Quantity below which the SKU is marked as "Low Stock" throughout the interface.
              </TableCell>
              <TableCell className="text-center">
                Yes
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
              <TableCell className="font-mono text-sm font-medium">Reorder Point</TableCell>
              <TableCell className="text-neutral-600 dark:text-neutral-400">
                Quantity below which a reorder alert will be triggered.
              </TableCell>
              <TableCell className="text-center">
                No
              </TableCell>
            </TableRow>
            <TableRow className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors">
              <TableCell className="font-mono text-sm font-medium">Alerts</TableCell>
              <TableCell className="text-neutral-600 dark:text-neutral-400">
                Enable or disable alerts for this SKU (on by default)
              </TableCell>
              <TableCell className="text-center">
                No
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-3 text-center">
        Defaults are inherited from your organization settings and can be customized per SKU
      </p>
    </div>
  );
}
