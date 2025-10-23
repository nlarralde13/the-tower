import PlayClient from "./PlayClient";

type SearchParams = {
  tower?: string | string[];
};

export default async function Play({
  searchParams,
}: {
  // In Next 16, searchParams is async in Server Components
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const tower =
    (Array.isArray(sp?.tower) ? sp?.tower[0] : sp?.tower) ?? "tower-1";

  return <PlayClient towerId={tower} />;
}
