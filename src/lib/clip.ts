// Resolve a goal's Brightcove id to a playable MP4 via Brightcove's public Playback API
// (the same call NHL's own player makes, minus the ad plugin). Signed URLs expire, so never cache them.
const ACCOUNT = "6415718365001", PLAYER = "EXtG1xJ7H_default";
let policyKey: Promise<string> | undefined;

const getKey = () =>
  (policyKey ??= fetch(`https://players.brightcove.net/${ACCOUNT}/${PLAYER}/config.json`)
    .then((r) => r.json()).then((c) => c.video_cloud.policy_key as string)
    .catch((e) => { policyKey = undefined; throw e; }));

export async function clipSource(videoId: number): Promise<{ src: string; title: string }> {
  const r = await fetch(`https://edge.api.brightcove.com/playback/v1/accounts/${ACCOUNT}/videos/${videoId}`, {
    headers: { Accept: `application/json;pk=${await getKey()}` },
  });
  if (!r.ok) throw new Error(`clip ${r.status}`);
  const d = await r.json();
  const mp4 = (d.sources ?? []).filter((s: any) => s.container === "MP4" && s.src?.startsWith("https"))
    .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0];
  if (!mp4) throw new Error("no mp4");
  return { src: mp4.src, title: d.name ?? "" };
}
