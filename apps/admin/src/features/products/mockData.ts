import { Grade } from "./types";

export const MOCK_GRADES: Grade[] = [
  {
    id: 1,
    name: "Tamanho",
    type: "Tamanho",
    categoryIds: [],
    variants: [
      { id: 101, value: "P" },
      { id: 102, value: "M" },
      { id: 103, value: "G" },
    ],
  },
  {
    id: 2,
    name: "Cor",
    type: "Cor",
    categoryIds: [],
    variants: [
      { id: 201, value: "Azul", colorHex: "#3b82f6" },
      { id: 202, value: "Vermelho", colorHex: "#ef4444" },
    ],
  },
];
