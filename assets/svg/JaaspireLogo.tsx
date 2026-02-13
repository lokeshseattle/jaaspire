import * as React from "react";
import Svg, {
  SvgProps,
  G,
  Path,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
} from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={208}
    height={48}
    viewBox="0 0 208 48"
    fill="none"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path
        d="M37.97 0H9.622C4.308 0 0 4.345 0 9.704v28.592C0 43.656 4.308 48 9.622 48H37.97c5.314 0 9.622-4.345 9.622-9.704V9.704C47.592 4.344 43.284 0 37.97 0"
        fill="url(#b)"
      />
      <Path
        d="M37.885 29.019h-6.51V13.945H26.33V7.37h11.554zM21.516 41.861h-2.001c-6.536 0-11.851-5.36-11.851-11.953v-2.95h6.51v2.95c0 2.967 2.4 5.387 5.34 5.387h2.002z"
        fill="#fff"
      />
      <Path
        d="M73.448 10.5v16.202c0 2.129-.144 5.472-2.79 7.276-1.034.684-2.466 1.086-3.89 1.086a7.8 7.8 0 0 1-5.46-2.232l2.823-3.42c.466.684 1.212 1.3 2.323 1.3 1 0 1.568-.436 1.823-.83.567-.829.534-2.41.534-3.89V10.5h4.645z"
        fill="url(#c)"
      />
      <Path
        d="M92.98 29.48h-9.605l-2.103 5.045h-5.035L86.486 10.5h3.645l9.961 24.025H95.09zm-1.357-3.821-3.39-8.644-3.392 8.644z"
        fill="url(#d)"
      />
      <Path
        d="M116.962 29.48h-9.605l-2.102 5.045h-5.036L110.468 10.5h3.645l9.961 24.025h-5.001zm-1.357-3.821-3.39-8.644-3.391 8.644z"
        fill="url(#e)"
      />
      <Path
        d="M137.816 15.972c-1.39-1.873-3.035-2.052-3.891-2.052-2.501 0-3.281 1.581-3.281 2.813 0 .572.178 1.12.746 1.624.568.539 1.357.83 2.857 1.368 1.857.65 3.603 1.3 4.824 2.411 1.068.975 2.034 2.59 2.034 5.045 0 4.685-3.357 7.891-8.282 7.891-4.391 0-6.96-2.702-8.215-4.54l3.035-2.915c1.145 2.342 3.323 3.206 5.002 3.206 2.111 0 3.679-1.3 3.679-3.317 0-.864-.288-1.548-.932-2.164-.891-.829-2.323-1.3-3.68-1.761-1.254-.436-2.746-1.009-3.967-2.086-.788-.684-1.89-2.018-1.89-4.463 0-3.531 2.356-7.063 7.638-7.063 1.5 0 4.323.291 6.748 2.813l-2.425 3.207z"
        fill="url(#f)"
      />
      <Path
        d="M152.092 10.5c2.679 0 4.535.29 6.282 1.838 1.924 1.727 2.424 4.07 2.424 5.797 0 .94-.144 3.53-1.967 5.37-1.322 1.333-3.289 2.128-6.035 2.128h-3.001v8.892h-4.646V10.5zm-2.289 11.089h1.891c.89 0 2.034 0 3.034-.752.857-.684 1.289-1.762 1.289-2.814 0-1.333-.644-2.231-1.323-2.735-.966-.684-2.178-.753-3.28-.753h-1.611v7.062z"
        fill="url(#g)"
      />
      <Path d="M168.869 10.5v24.025h-4.646V10.5z" fill="url(#h)" />
      <Path
        d="M181.186 10.5c3.289 0 4.968.863 6.07 1.803 1.823 1.548 2.357 3.6 2.357 5.404 0 2.343-.933 4.395-2.789 5.652-.611.436-1.467.83-2.603 1.043l7.426 10.123h-5.781l-6.358-9.653h-.568v9.653h-4.646V10.5zm-2.246 11.055h1.322c.89 0 4.569-.111 4.569-3.634s-3.645-3.6-4.501-3.6h-1.39v7.242z"
        fill="url(#i)"
      />
      <Path
        d="M208 14.535h-8.571v5.37h8.215v4.035h-8.215v6.558H208v4.036h-13.216V10.5H208z"
        fill="url(#j)"
      />
    </G>
    <Defs>
      <LinearGradient
        id="b"
        x1={38.292}
        y1={49.317}
        x2={8.935}
        y2={-1.1}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#00ffeb" />
        <Stop offset={0.31} stopColor="#007aff" />
        <Stop offset={0.825} stopColor="#5a42b7" />
      </LinearGradient>
      <LinearGradient
        id="c"
        x1={67.382}
        y1={10.499}
        x2={67.382}
        y2={35.064}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="d"
        x1={88.164}
        y1={10.499}
        x2={88.164}
        y2={34.525}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="e"
        x1={112.147}
        y1={10.499}
        x2={112.147}
        y2={34.525}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="f"
        x1={132.857}
        y1={9.969}
        x2={132.857}
        y2={35.072}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="g"
        x1={152.974}
        y1={10.499}
        x2={152.974}
        y2={34.525}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="h"
        x1={166.546}
        y1={10.499}
        x2={166.546}
        y2={34.525}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="i"
        x1={182.971}
        y1={10.499}
        x2={182.971}
        y2={34.525}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <LinearGradient
        id="j"
        x1={201.392}
        y1={10.499}
        x2={201.392}
        y2={34.534}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5a42b7" />
        <Stop offset={1} stopColor="#007aff" />
      </LinearGradient>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h208v48H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SVGComponent;
