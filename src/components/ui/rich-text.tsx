import { router } from "expo-router";
import * as Linking from "expo-linking";
import React from "react";
import { Text, TextProps } from "react-native";

type SegmentStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  linkUrl?: string;
};

/** Parse simple HTML into text segments with style flags (handles nesting). */
function parseHtmlToSegments(html: string): { text: string; style: SegmentStyle }[] {
  const segments: { text: string; style: SegmentStyle }[] = [];
  const stack: SegmentStyle[] = [{}];
  let pos = 0;
  const len = html.length;

  const openTagRe = /^<(b|strong|i|em|u|a)(?:\s[^>]*)?>/i;
  const closeTagRe = /^<\/(b|strong|i|em|u|a)>/i;
  const aHrefRe = /href=["']([^"']*)["']/i;

  while (pos < len) {
    if (html[pos] === "<") {
      const openMatch = html.slice(pos).match(openTagRe);
      const closeMatch = html.slice(pos).match(closeTagRe);

      if (closeMatch) {
        pos += closeMatch[0].length;
        stack.pop();
        if (stack.length === 0) stack.push({});
        continue;
      }

      if (openMatch) {
        const tag = openMatch[1].toLowerCase();
        const fullTag = openMatch[0];
        pos += fullTag.length;
        const next: SegmentStyle = { ...stack[stack.length - 1] };
        if (tag === "b" || tag === "strong") next.bold = true;
        else if (tag === "i" || tag === "em") next.italic = true;
        else if (tag === "u") next.underline = true;
        else if (tag === "a") {
          const hrefMatch = fullTag.match(aHrefRe);
          next.linkUrl = hrefMatch ? hrefMatch[1] : undefined;
        }
        stack.push(next);
        continue;
      }

      // <br> or <br/> → newline; other unknown tags: skip until next >
      const rest = html.slice(pos);
      const brMatch = rest.match(/^<br\s*\/?>/i);
      if (brMatch) {
        segments.push({ text: "\n", style: { ...stack[stack.length - 1] } });
        pos += brMatch[0].length;
        continue;
      }
      const end = html.indexOf(">", pos);
      pos = end === -1 ? len : end + 1;
      continue;
    }

    let end = html.indexOf("<", pos);
    if (end === -1) end = len;
    const text = html.slice(pos, end);
    if (text) {
      segments.push({ text, style: { ...stack[stack.length - 1] } });
    }
    pos = end;
  }

  return segments;
}

const combinedRegex = /(#+\w+)|(@\w+)/g;

function renderPart(
  part: string,
  key: React.Key,
  baseStyle: SegmentStyle,
  textStyle: TextProps["style"]
): React.ReactNode {
  if (part.startsWith("#")) {
    return (
      <Text
        key={key}
        style={[
          textStyle,
          baseStyle.bold && { fontWeight: "700" as const },
          baseStyle.italic && { fontStyle: "italic" as const },
          baseStyle.underline && { textDecorationLine: "underline" as const },
          { color: "#007AFF" },
        ]}
        onPress={() => router.push(`/user/${part.slice(1)}`)}
      >
        {part}
      </Text>
    );
  }
  if (part.startsWith("@")) {
    return (
      <Text
        key={key}
        style={[
          textStyle,
          baseStyle.bold && { fontWeight: "700" as const },
          baseStyle.italic && { fontStyle: "italic" as const },
          baseStyle.underline && { textDecorationLine: "underline" as const },
          { color: "#5856D6" },
        ]}
        onPress={() => router.push(`/user/${part.slice(1)}`)}
      >
        {part}
      </Text>
    );
  }
  if (baseStyle.linkUrl) {
    return (
      <Text
        key={key}
        style={[
          textStyle,
          baseStyle.bold && { fontWeight: "700" as const },
          baseStyle.italic && { fontStyle: "italic" as const },
          baseStyle.underline && { textDecorationLine: "underline" as const },
          { color: "#007AFF" },
        ]}
        onPress={() => {
          const url = baseStyle.linkUrl!;
          if (url.startsWith("/")) {
            router.push(url as any);
          } else {
            Linking.openURL(url).catch(() => {});
          }
        }}
      >
        {part}
      </Text>
    );
  }
  return (
    <Text
      key={key}
      style={[
        textStyle,
        baseStyle.bold && { fontWeight: "700" as const },
        baseStyle.italic && { fontStyle: "italic" as const },
        baseStyle.underline && { textDecorationLine: "underline" as const },
      ]}
    >
      {part}
    </Text>
  );
}

/** Renders a segment (with optional HTML-derived styles) and hashtags/mentions. */
function renderSegment(
  segment: { text: string; style: SegmentStyle },
  segIndex: number,
  textStyle: TextProps["style"]
): React.ReactNode {
  const parts = segment.text.split(combinedRegex).filter(Boolean);
  return parts.map((part, index) =>
    renderPart(part, `${segIndex}-${index}`, segment.style, textStyle)
  );
}

// RichText Component - parses simple HTML (b, i, u, a) and hashtags/mentions
const RichText = ({
  children,
  style,
  ...props
}: TextProps & { children: string }) => {
  const str = children ?? "";
  // Run HTML parser for any caption that might contain tags (web sends <p>, <br>, etc.;
  // parser strips unknown tags and applies b/i/u/a styling)
  const hasHtml = str.includes("<");

  if (!hasHtml) {
    // Original behavior: only # and @
    const parts = str.split(combinedRegex).filter(Boolean);
    return (
      <Text style={style} {...props}>
        {parts.map((part, index) => {
          if (part.startsWith("#")) {
            return (
              <Text
                key={index}
                style={[style, { color: "#007AFF" }]}
                onPress={() => router.push(`/user/${part.slice(1)}`)}
              >
                {part}
              </Text>
            );
          }
          if (part.startsWith("@")) {
            return (
              <Text
                key={index}
                style={[style, { color: "#5856D6" }]}
                onPress={() => router.push(`/user/${part.slice(1)}`)}
              >
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  }

  const segments = parseHtmlToSegments(str);
  return (
    <Text style={style} {...props}>
      {segments.map((seg, segIndex) =>
        renderSegment(seg, segIndex, style)
      )}
    </Text>
  );
};

export default RichText;
