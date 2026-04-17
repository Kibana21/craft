"use client";

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { TemplateZone } from "@/types/brand-kit";

interface ZoneTableProps {
  zones: TemplateZone[];
}

export function ZoneTable({ zones }: ZoneTableProps) {
  return (
    <Box>
      <Box
        sx={{
          border: "1px solid #E8EAED",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#F7F7F7" }}>
              <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Zone</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>x</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>y</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>width</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>height</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {zones.map((zone) => (
              <TableRow key={zone.name}>
                <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>{zone.name}</TableCell>
                <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{zone.x}</TableCell>
                <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{zone.y}</TableCell>
                <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{zone.width}</TableCell>
                <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>{zone.height}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography sx={{ mt: 1, fontSize: 11, color: "#9E9E9E" }}>
        Coordinates assume a 1080 x 1080 base canvas. The compositing layer scales proportionally for other formats.
      </Typography>
    </Box>
  );
}
