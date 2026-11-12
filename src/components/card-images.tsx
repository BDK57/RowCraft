import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { motion, type PanInfo } from "motion/react";
import {
  ImagePlus,
  FolderOpen,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { Studio } from "@/hooks/use-studio";
import type {
  Card,
  ImageAsset,
  PhotoAdjustment,
  PhotoTarget,
  Row,
} from "@/lib/types";
import { api } from "@/lib/api";
import {
  DEFAULT_PHOTO,
  photoLayout,
  photoPosition,
} from "../../server/photos.mjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChoiceSelect } from "@/components/choice-select";

export function CardImageSource({ s }: { s: Studio }) {
  const folder = useRef<HTMLInputElement>(null),
    files = useRef<HTMLInputElement>(null),
    shared = useRef<HTMLInputElement>(null);
  const accept = ".jpg,.jpeg,.png,.webp,.tif,.tiff,.avif,.gif";
  return (
    <section className="photo-source">
      <div className="photo-source-heading">
        <span className="eyebrow">Optional / card images</span>
        <h3>Photos for your cards</h3>
        <p>
          Keep the artwork’s image, use a photo column, or apply one image to
          every card.
        </p>
      </div>
      <Tabs
        value={s.images.source}
        onValueChange={(value) =>
          s.images.setSource(value as "keep" | "column" | "shared")
        }
      >
        <TabsList className="photo-source-tabs">
          <TabsTrigger value="keep" disabled={s.running}>
            Keep original
          </TabsTrigger>
          <TabsTrigger value="column" disabled={s.running}>
            Excel column
          </TabsTrigger>
          <TabsTrigger value="shared" disabled={s.running}>
            One image for all
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {s.images.source === "column" && (
        <div className="photo-source-options">
          <div className="photo-field">
            <Label>Image column</Label>
            <ChoiceSelect
              label="Excel image column"
              value={String(s.images.column)}
              placeholder="Choose image column"
              options={[
                { value: "-1", label: "Choose image column" },
                ...(s.sheet?.columns.map((label, i) => ({
                  value: String(i),
                  label,
                })) || []),
              ]}
              disabled={s.running}
              onChange={(v) => s.images.setColumn(Number(v))}
            />
          </div>
          {/* <div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={s.running}
                onClick={() => folder.current?.click()}
              >
                <FolderOpen />
                Choose image folder
              </Button>
              <Button
                variant="ghost"
                disabled={s.running}
                onClick={() => files.current?.click()}
              >
                Choose files
              </Button>
            </div>
          </div> */}
        </div>
      )}
      <p className="photo-source-note">
        {s.images.library
          ? `${s.images.library.assets.length} images imported. `
          : ""}
        HTTPS URLs work directly. For filenames or paths, choose their image
        folder. Blank or unavailable photos keep the original.
      </p>
      {s.images.source === "shared" && (
        <div className="photo-shared-source">
          {s.images.shared?.assets[0] && (
            <img
              src={s.images.shared.assets[0].preview}
              alt="Shared card image"
            />
          )}
          <div>
            <Button
              variant="outline"
              disabled={s.running}
              onClick={() => shared.current?.click()}
            >
              <ImagePlus />
              {s.images.shared
                ? "Replace shared image"
                : "Upload image for all cards"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Overrides the Excel image column. The same crop applies to every
              generated card.
            </p>
          </div>
        </div>
      )}
      {!!s.images.error && (
        <p role="alert" className="text-destructive text-sm">
          {s.images.error}
        </p>
      )}
      <input
        ref={(node) => {
          folder.current = node;
          node?.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        className="hidden"
        aria-label="Import image folder"
        accept={accept}
        onChange={(e) => {
          void s.uploadImages(Array.from(e.currentTarget.files || []));
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={files}
        type="file"
        multiple
        className="hidden"
        aria-label="Import image files"
        accept={accept}
        onChange={(e) => {
          void s.uploadImages(Array.from(e.currentTarget.files || []));
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={shared}
        type="file"
        className="hidden"
        aria-label="Upload shared card image"
        accept={accept}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void s.uploadImages([file], true);
          e.currentTarget.value = "";
        }}
      />
    </section>
  );
}

export function useResolvedPhoto(s: Studio, row: Row | undefined) {
  const [state, setState] = useState<{
    key: string;
    asset?: ImageAsset;
    message?: string;
  }>({ key: "" });
  const reference =
    s.images.source === "column" && row
      ? (row.imageRefs?.[s.images.column] ?? row.values[s.images.column] ?? "")
      : "";
  const key = JSON.stringify([
    s.images.source,
    s.images.library?.id,
    reference,
  ]);
  useEffect(() => {
    if (s.images.source !== "column" || !String(reference).trim()) return;
    let cancelled = false;
    api<{ available: boolean; asset?: ImageAsset; message?: string }>(
      "/api/images/resolve",
      { reference, libraryId: s.images.library?.id },
    )
      .then((result) => {
        if (!cancelled)
          setState({ key, asset: result.asset, message: result.message });
      })
      .catch((error) => {
        if (!cancelled) setState({ key, message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [key, reference, s.images.source, s.images.library?.id]);
  if (s.images.source === "shared")
    return {
      asset: s.images.shared?.assets[0],
      loading: false,
      message: s.images.shared ? "" : "Upload your shared image.",
    };
  if (s.images.source === "keep")
    return {
      asset: undefined,
      loading: false,
      message: "Original image stays unchanged.",
    };
  if (s.images.column < 0)
    return {
      asset: undefined,
      loading: false,
      message: "Choose your Excel image column.",
    };
  if (!String(reference).trim())
    return {
      asset: undefined,
      loading: false,
      message: "This row has no image. Its original photo will stay.",
    };
  return {
    asset: state.key === key ? state.asset : undefined,
    loading: state.key !== key,
    message: state.key === key ? state.message : "Loading this person’s image…",
  };
}

type FrameProps = {
  asset: ImageAsset;
  target: PhotoTarget;
  value: PhotoAdjustment;
  onChange: (a: PhotoAdjustment) => void;
  style?: CSSProperties;
  disabled?: boolean;
};
export function PhotoFrame({
  asset,
  target,
  value,
  onChange,
  style,
  disabled,
}: FrameProps) {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 1, height: 1 }),
    [draft, setDraft] = useState<PhotoAdjustment | null>(null);
  const drag = useRef<{
      layout: ReturnType<typeof photoLayout>;
      scale: number;
      value: PhotoAdjustment;
    } | null>(null),
    clipId = useId().replace(/[^a-zA-Z0-9]/g, "");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: node.clientWidth || 1, height: node.clientHeight || 1 }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setDraft(null);
    drag.current = null;
  }, [asset.id, value]);
  const a = draft || value,
    layout = photoLayout(size.width, size.height, asset.width, asset.height, a);
  function move(dx: number, dy: number) {
    onChange(
      photoPosition(
        size.width,
        size.height,
        layout,
        layout.left + dx,
        layout.top + dy,
        value,
      ),
    );
  }
  function pan(info: PanInfo, commit = false) {
    const start = drag.current;
    if (!start || disabled) return;
    const next = photoPosition(
      size.width,
      size.height,
      start.layout,
      start.layout.left + info.offset.x / start.scale,
      start.layout.top + info.offset.y / start.scale,
      start.value,
    );
    if (commit) {
      onChange(next);
      setDraft(null);
      drag.current = null;
    } else setDraft(next);
  }
  return (
    <motion.div
      ref={ref}
      className="photo-frame"
      data-photo-frame
      role="group"
      aria-label="Photo crop preview. Drag to reposition, or use arrow keys."
      tabIndex={disabled ? -1 : 0}
      style={{
        ...style,
        touchAction: disabled ? "auto" : "none",
        clipPath: target.clipPath ? `url(#photo-${clipId})` : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const deltas: Record<string, [number, number]> = {
          ArrowLeft: [-5, 0],
          ArrowRight: [5, 0],
          ArrowUp: [0, -5],
          ArrowDown: [0, 5],
        };
        if (deltas[e.key] && !disabled) {
          e.preventDefault();
          e.stopPropagation();
          move(...deltas[e.key]);
        }
      }}
      onPanStart={() => {
        if (!disabled && ref.current)
          drag.current = {
            layout,
            value,
            scale:
              ref.current.getBoundingClientRect().width /
                ref.current.clientWidth || 1,
          };
      }}
      onPan={(_, info) => pan(info)}
      onPanEnd={(_, info) => pan(info, true)}
    >
      {target.clipPath && (
        <svg width="0" height="0" aria-hidden="true">
          <defs>
            <clipPath id={`photo-${clipId}`} clipPathUnits="objectBoundingBox">
              <path d={target.clipPath} clipRule="evenodd" />
            </clipPath>
          </defs>
        </svg>
      )}
      <img
        src={asset.preview}
        alt={asset.name}
        draggable={false}
        style={{
          width: layout.width,
          height: layout.height,
          left: layout.left,
          top: layout.top,
        }}
      />
    </motion.div>
  );
}

export function PhotoEditor({
  s,
  card,
  scope,
  row,
  targetId,
  onTarget,
  resolved,
}: {
  s: Studio;
  card: Card | undefined;
  scope: string;
  row: Row | undefined;
  targetId?: string;
  onTarget: (id: string) => void;
  resolved: ReturnType<typeof useResolvedPhoto>;
}) {
  const target =
      card?.photos?.find((p) => p.id === targetId) || card?.photos?.[0],
    a = s.images.adjustment(scope, target?.id || "", row?.id || "");
  function change(value: PhotoAdjustment) {
    if (target && row) s.images.adjust(scope, target.id, row.id, value);
  }
  const error = s.images.source !== "keep" && !target;
  return (
    <div className="photo-editor">
      <div className="photo-editor-heading">
        <h4>Card photo</h4>
        <p>
          {s.images.source === "shared"
            ? "One crop for every card."
            : "Adjustments are saved for this person only. Other people start with centered Fill."}
        </p>
      </div>
      {s.images.source === "keep" ? (
        <p className="text-sm text-muted-foreground">
          Enable Excel photos or a shared image above to replace a card’s photo.
        </p>
      ) : (
        <>
          {!card ? (
            <p>Choose a sample card first.</p>
          ) : card.photos === undefined ? (
            <>
              <p className="text-sm">
                This template was analyzed before photo support. Analyze it once
                more to find its photo areas.
              </p>
              <Button
                variant="outline"
                disabled={s.running}
                onClick={() => void s.analyzeCards()}
              >
                Analyze photo areas
              </Button>
            </>
          ) : error ? (
            <p role="status" className="text-sm">
              No replaceable photo group found in this card. In Illustrator,
              group its photo separately from its text, then upload the updated
              design.
            </p>
          ) : (
            <>
              <div className="photo-field">
                <Label>Photo area</Label>
                <ChoiceSelect
                  label="Photo area to replace"
                  value={target!.id}
                  options={card.photos!.map((p, i) => ({
                    value: p.id,
                    label: `${i + 1}. ${p.name}`,
                  }))}
                  disabled={s.running}
                  onChange={onTarget}
                />
              </div>
              {resolved.asset && row ? (
                <>
                  <div className="photo-adjust-preview">
                    <PhotoFrame
                      key={scope + row.id + target!.id}
                      asset={resolved.asset}
                      target={target!}
                      value={a}
                      onChange={change}
                      disabled={s.running}
                      style={{
                        aspectRatio: String(
                          (target!.width * s.board!.width) /
                            (target!.height * s.board!.height),
                        ),
                      }}
                    />
                  </div>
                  <div className="photo-fit-controls">
                    <Button
                      size="sm"
                      variant={a.fit === "fill" ? "secondary" : "outline"}
                      aria-pressed={a.fit === "fill"}
                      disabled={s.running}
                      onClick={() => change({ ...a, fit: "fill", zoom: 1 })}
                    >
                      Fill
                    </Button>
                    <Button
                      size="sm"
                      variant={a.fit === "fit" ? "secondary" : "outline"}
                      aria-pressed={a.fit === "fit"}
                      disabled={s.running}
                      onClick={() => change({ ...a, fit: "fit", zoom: 1 })}
                    >
                      Fit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={s.running}
                      onClick={() => change({ ...DEFAULT_PHOTO })}
                    >
                      <RotateCcw />
                      Reset
                    </Button>
                  </div>
                  <div className="photo-zoom">
                    <Label>
                      Zoom <span>{a.zoom.toFixed(2)}×</span>
                    </Label>
                    <Input
                      type="range"
                      aria-label="Photo zoom"
                      min={1}
                      max={4}
                      step={0.01}
                      value={a.zoom}
                      disabled={s.running}
                      onChange={(e) =>
                        change({ ...a, zoom: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div
                    className="photo-nudge-controls"
                    role="group"
                    aria-label="Reposition photo"
                  >
                    {[
                      [ArrowLeft, "Left", -5, 0],
                      [ArrowRight, "Right", 5, 0],
                      [ArrowUp, "Up", 0, -5],
                      [ArrowDown, "Down", 0, 5],
                    ].map(([Icon, label, dx, dy]) => {
                      const I = Icon as typeof ArrowLeft;
                      return (
                        <Button
                          key={String(label)}
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Move photo ${String(label).toLowerCase()}`}
                          disabled={s.running}
                          onClick={() => {
                            const width = 240,
                              height =
                                (width * target!.height * s.board!.height) /
                                (target!.width * s.board!.width),
                              l = photoLayout(
                                width,
                                height,
                                resolved.asset!.width,
                                resolved.asset!.height,
                                a,
                              );
                            change(
                              photoPosition(
                                width,
                                height,
                                l,
                                l.left + Number(dx),
                                l.top + Number(dy),
                                a,
                              ),
                            );
                          }}
                        >
                          <I />
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Drag the photo or use the arrow buttons. Fill crops the
                    edges; Fit shows the whole image on white. No stretching.
                  </p>
                </>
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  {resolved.loading
                    ? "Loading image…"
                    : resolved.message || "Choose a person to preview."}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
