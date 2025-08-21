export async function generateVariants(input: string, recipe: string) {
  return [
    {
      id: crypto.randomUUID(),
      title: "Variant",
      lines: input.split("\n"),
      tags: [recipe],
    },
  ];
}
