/**
 * Home Page — Belt Drive Generator
 *
 * Split-panel layout: left sidebar controls, right canvas workspace.
 * Matches Make-Gears UI pattern exactly.
 *
 * Style: Clean utilitarian — white sidebar, light gray canvas, blue accents.
 * Grid background, dashed guide circles, on-canvas dimension annotations.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import BeltCanvas from "@/components/BeltCanvas";
import BeltControls from "@/components/BeltControls";
import {
  type PulleyParams,
  type BeltSystemParams,
  type BeltType,
  type VBeltSection,
  type TimingProfile,
  computeBeltGeometry,
  validateBeltSystem,
  createDefaultPulley,
  createDefaultSystem,
  PULLEY_COLORS,
} from "@/lib/beltMath";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── URL share config ─────────────────────────────────────────────────────────

function encodeConfig(driver: PulleyParams, driven: PulleyParams, system: BeltSystemParams): string {
  try {
    const data = JSON.stringify({ driver, driven, system });
    return btoa(encodeURIComponent(data));
  } catch {
    return "";
  }
}

function decodeConfig(hash: string): { driver: PulleyParams; driven: PulleyParams; system: BeltSystemParams } | null {
  try {
    const data = JSON.parse(decodeURIComponent(atob(hash)));
    if (data.driver && data.driven && data.system) return data;
    return null;
  } catch {
    return null;
  }
}

function readConfigFromUrl(): { driver: PulleyParams; driven: PulleyParams; system: BeltSystemParams } | null {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return null;
  return decodeConfig(hash);
}

function pushConfigToUrl(driver: PulleyParams, driven: PulleyParams, system: BeltSystemParams) {
  const encoded = encodeConfig(driver, driven, system);
  window.history.replaceState(null, "", `#${encoded}`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  // Initialize from URL or defaults
  const [driver, setDriver] = useState<PulleyParams>(() => {
    const fromUrl = readConfigFromUrl();
    if (fromUrl) return fromUrl.driver;
    return createDefaultPulley(nanoid(8), {
      name: "Driver",
      diameter: 80,
      timingTeeth: 20,
      centerX: -120,
      centerY: 0,
      color: PULLEY_COLORS[0],
      rpm: 5,
      isDriver: true,
      bore: 20,
      spokes: 5,
    });
  });

  const [driven, setDriven] = useState<PulleyParams>(() => {
    const fromUrl = readConfigFromUrl();
    if (fromUrl) return fromUrl.driven;
    return createDefaultPulley(nanoid(8), {
      name: "Driven",
      diameter: 200,
      timingTeeth: 60,
      centerX: 120,
      centerY: 0,
      color: PULLEY_COLORS[1],
      rpm: 0,
      isDriver: false,
      bore: 30,
      spokes: 6,
    });
  });

  const [system, setSystem] = useState<BeltSystemParams>(() => {
    const fromUrl = readConfigFromUrl();
    if (fromUrl) return fromUrl.system;
    return createDefaultSystem();
  });

  const [selectedPulleyId, setSelectedPulleyId] = useState<string | null>(driver.id);
  const [animating, setAnimating] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Compute geometry and warnings
  const geo = useMemo(() => {
    try {
      return computeBeltGeometry(driver, driven, system);
    } catch {
      return null;
    }
  }, [driver, driven, system]);

  const warnings = useMemo(() => {
    if (!geo) return [];
    return validateBeltSystem(driver, driven, system, geo);
  }, [driver, driven, system, geo]);

  // Update handlers
  const handleUpdateDriver = useCallback((updates: Partial<PulleyParams>) => {
    setDriver((d) => ({ ...d, ...updates }));
  }, []);

  const handleUpdateDriven = useCallback((updates: Partial<PulleyParams>) => {
    setDriven((d) => ({ ...d, ...updates }));
  }, []);

  const handleUpdateSystem = useCallback((updates: Partial<BeltSystemParams>) => {
    setSystem((s) => ({ ...s, ...updates }));
  }, []);

  const handleToggleAnimation = useCallback(() => {
    setAnimating((a) => !a);
  }, []);

  const handleResetView = useCallback(() => {
    // Trigger canvas reset via a state change
    setSystem((s) => ({ ...s }));
  }, []);

  const handleApplyWizard = useCallback((beltType: BeltType, section?: VBeltSection, timingProfile?: TimingProfile, numBelts?: number) => {
    setSystem((s) => ({
      ...s,
      beltType,
      ...(section ? { vbeltSection: section } : {}),
      ...(timingProfile ? { timingProfile } : {}),
      ...(numBelts ? { numBelts } : {}),
    }));
    toast.success(`Applied: ${beltType === "vbelt" ? `V-Belt ${section}` : beltType === "timing" ? `${timingProfile} Timing` : beltType} × ${numBelts ?? 1}`);
  }, []);

  const handleShareConfig = useCallback(() => {
    pushConfigToUrl(driver, driven, system);
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share link copied to clipboard!");
    }).catch(() => {
      toast.info("Share URL updated in address bar");
    });
  }, [driver, driven, system]);

  // Auto-update URL on changes (debounced)
  const urlUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (urlUpdateTimer.current) clearTimeout(urlUpdateTimer.current);
    urlUpdateTimer.current = setTimeout(() => {
      pushConfigToUrl(driver, driven, system);
    }, 500);
    return () => {
      if (urlUpdateTimer.current) clearTimeout(urlUpdateTimer.current);
    };
  }, [driver, driven, system]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8f8f8]">
      {/* Mobile sidebar toggle — shown only when sidebar is closed */}
      {!mobileSidebarOpen && (
        <button
          className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-md active:scale-95 transition-transform"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open controls"
        >
          <ChevronRight size={18} className="text-gray-700" />
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`
          flex-shrink-0 w-full md:w-[320px] h-full overflow-hidden
          transition-transform duration-200 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          fixed md:relative z-40 md:z-auto
        `}
      >
        <BeltControls
          driver={driver}
          driven={driven}
          system={system}
          selectedPulleyId={selectedPulleyId}
          onSelectPulley={setSelectedPulleyId}
          onUpdateDriver={handleUpdateDriver}
          onUpdateDriven={handleUpdateDriven}
          onUpdateSystem={handleUpdateSystem}
          animating={animating}
          onToggleAnimation={handleToggleAnimation}
          onResetView={handleResetView}
          onShareConfig={handleShareConfig}
          onApplyWizard={handleApplyWizard}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          warnings={warnings}
          geo={geo}
        />
      </div>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/20"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Canvas */}
      <div className="flex-1 h-full overflow-hidden">
        <BeltCanvas
          driver={driver}
          driven={driven}
          system={system}
          selectedPulleyId={selectedPulleyId}
          onSelectPulley={setSelectedPulleyId}
          animating={animating}
          warnings={warnings}
        />
      </div>
    </div>
  );
}
