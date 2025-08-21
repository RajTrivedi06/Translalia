export async function retrieveContext(_query: string) {
  return { passages: [], sources: [] as Array<{ title: string; url: string }> };
}
