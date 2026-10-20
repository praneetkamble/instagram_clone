"use client";
import { useRef, useState } from "react";
import { X, ImagePlus } from "lucide-react";
import Link from "next/link";
import { uploadFiles } from "@/lib/imgbb.service";
import axiosInstance from "@/lib/axios";
import { useI18n, errorText } from "@/lib/i18n";
import { toast } from "../ui/toast";

export default function CreateStoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; type: string }[]>([]);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pick = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => /^(image|video)\//.test(f.type)).slice(0, 10 - files.length);
    setFiles((p) => [...p, ...arr]);
    setPreviews((p) => [...p, ...arr.map((f) => ({ url: URL.createObjectURL(f), type: f.type.startsWith("video") ? "video" : "image" }))]);
  };
  const durationOf = (url: string) => new Promise<number>((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => res(Math.round(v.duration) || 15); v.onerror = () => res(15); v.src = url; });
  const share = async () => {
    if (!files.length) return toast.add({ type: "error", title: t("validation.mediaRequired") });
    setBusy(true);
    try {
      const uploaded = await uploadFiles(files);
      const media = await Promise.all(uploaded.map(async (u: any, i: number) => ({ ...u, duration: u.type === "video" ? await durationOf(previews[i].url) : 5 })));
      await axiosInstance.post("/api/stories", { media, caption, privacy });
      toast.add({ type: "success", title: t("story.posted") });
      onCreated();
    } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" data-testid="create-story">
      <div className="bg-ig-surface rounded-xl w-full max-w-md p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-ig-text">{t("story.new")}</h2><button onClick={onClose}><X className="text-ig-text" /></button></div>
        <input ref={ref} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        <div className="grid grid-cols-3 gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative aspect-[9/16] bg-black rounded overflow-hidden">
              {p.type === "video" ? <video src={p.url} className="w-full h-full object-cover" muted /> : <img src={p.url} className="w-full h-full object-cover" alt="" />}
              <button className="absolute top-1 right-1 bg-black/60 rounded-full text-white" onClick={() => { setFiles(files.filter((_, j) => j !== i)); setPreviews(previews.filter((_, j) => j !== i)); }}><X size={14} /></button>
            </div>
          ))}
          {files.length < 10 && <button onClick={() => ref.current?.click()} className="aspect-[9/16] border-2 border-dashed border-ig-border rounded flex flex-col items-center justify-center text-ig-muted text-xs gap-1"><ImagePlus />{t("story.add")}</button>}
        </div>
        {files.length > 0 && <p className="text-xs text-ig-muted">{t("story.mediaCount", { count: files.length })}</p>}
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("create.caption")} className="bg-ig-bg border border-ig-border rounded px-2 py-2 text-sm text-ig-text" />
        <label className="text-sm text-ig-text">{t("story.privacy")}
          <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="mt-1 w-full bg-ig-bg border border-ig-border rounded px-2 py-2 text-sm text-ig-text">
            <option value="public">{t("story.public")}</option>
            <option value="followers">{t("story.followers")}</option>
            <option value="close_friends">{t("story.closeFriends")}</option>
          </select>
        </label>
        {privacy === "close_friends" && <Link href="/settings?tab=closeFriends" className="text-xs text-[#0095f6]">{t("story.manageCloseFriends")}</Link>}
        <button disabled={busy} onClick={share} className="bg-[#0095f6] text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">{busy ? t("common.loading") : t("story.share")}</button>
      </div>
    </div>
  );
}
