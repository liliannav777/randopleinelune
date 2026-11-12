// Illustrations vectorielles de l'identité « nuit étoilée » : ciel, lune, collines.
// Elles servent de fond aux en-têtes et d'image par défaut quand une sortie n'a
// pas encore de photo (chaque sortie a son propre paysage, dérivé de son id).
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';

/** Générateur pseudo-aléatoire déterministe (même graine = même dessin). */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Ligne de crête douce sur une largeur de 400, entre yMin et yMax. */
function ridge(r: () => number, yMin: number, yMax: number, height: number, bumps: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= bumps; i++) pts.push([(400 / bumps) * i, yMin + r() * (yMax - yMin)]);
  let d = `M0 ${height} L0 ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `${d} L400 ${height} Z`;
}

type SkyProps = {
  /** Hauteur logique du dessin (le dessin couvre son conteneur). */
  height: number;
  seed?: string;
  moon?: { x: number; y: number; r: number } | false;
  hills?: boolean;
  stars?: number;
  style?: StyleProp<ViewStyle>;
};

export const NightSky = memo(function NightSky({ height, seed = 'rpl', moon, hills = true, stars = 40, style }: SkyProps) {
  const art = useMemo(() => {
    const r = rng(seed);
    const starList = Array.from({ length: stars }, () => ({
      x: r() * 400, y: r() * height * 0.62, s: 0.4 + r() * 1.1, o: 0.25 + r() * 0.6,
    }));
    const m = moon === false ? null : moon ?? { x: 95 + r() * 110, y: height * (0.2 + r() * 0.12), r: 18 + r() * 10 };
    const far = hills ? ridge(r, height * 0.58, height * 0.72, height, 4) : null;
    const mid = hills ? ridge(r, height * 0.70, height * 0.82, height, 5) : null;
    const near = hills ? ridge(r, height * 0.82, height * 0.92, height, 3) : null;
    return { starList, m, far, mid, near };
  }, [seed, height, moon, hills, stars]);

  const id = `s${seed.replace(/[^a-z0-9]/gi, '').slice(0, 10)}${height}`;
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 400 ${height}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.night} />
            <Stop offset="0.6" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.slate} />
          </LinearGradient>
          <RadialGradient id={`${id}halo`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.accentLight} stopOpacity="0.45" />
            <Stop offset="0.45" stopColor={colors.accent} stopOpacity="0.12" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}moon`} cx="40%" cy="38%" r="70%">
            <Stop offset="0" stopColor="#FFF4D6" />
            <Stop offset="0.55" stopColor={colors.accentLight} />
            <Stop offset="1" stopColor={colors.accent} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height={height} fill={`url(#${id}sky)`} />
        {art.starList.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#FFFFFF" opacity={s.o} />
        ))}
        {art.m ? (
          <>
            <Circle cx={art.m.x} cy={art.m.y} r={art.m.r * 4} fill={`url(#${id}halo)`} />
            <Circle cx={art.m.x} cy={art.m.y} r={art.m.r} fill={`url(#${id}moon)`} />
            <Circle cx={art.m.x - art.m.r * 0.3} cy={art.m.y + art.m.r * 0.2} r={art.m.r * 0.16} fill={colors.accent} opacity={0.35} />
            <Circle cx={art.m.x + art.m.r * 0.32} cy={art.m.y - art.m.r * 0.25} r={art.m.r * 0.1} fill={colors.accent} opacity={0.3} />
          </>
        ) : null}
        {art.far ? <Path d={art.far} fill="#2A4462" opacity={0.85} /> : null}
        {art.mid ? <Path d={art.mid} fill="#1C3150" /> : null}
        {art.near ? <Path d={art.near} fill="#101D30" /> : null}
      </Svg>
    </View>
  );
});

/** Petite lune dorée (logo). */
export function MoonMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <RadialGradient id="mm" cx="40%" cy="38%" r="70%">
          <Stop offset="0" stopColor="#FFF4D6" />
          <Stop offset="0.55" stopColor={colors.accentLight} />
          <Stop offset="1" stopColor={colors.accent} />
        </RadialGradient>
      </Defs>
      <Circle cx="20" cy="20" r="19" fill={colors.accent} opacity={0.18} />
      <Circle cx="20" cy="20" r="14" fill="url(#mm)" />
      <Circle cx="15.5" cy="22" r="2.4" fill={colors.accent} opacity={0.4} />
      <Circle cx="24.5" cy="16" r="1.5" fill={colors.accent} opacity={0.35} />
    </Svg>
  );
}
