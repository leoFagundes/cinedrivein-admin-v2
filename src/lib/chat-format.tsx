import { Fragment } from "react";

export function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderLine(line)}
    </Fragment>
  ));
}

function renderLine(line: string) {
  if (line.startsWith("# ")) {
    return (
      <span style={{ fontSize: "1.1em", fontWeight: 700, display: "block" }}>
        {renderInline(line.slice(2))}
      </span>
    );
  }
  if (line.startsWith("## ")) {
    return (
      <span style={{ fontSize: "1em", fontWeight: 700, display: "block" }}>
        {renderInline(line.slice(3))}
      </span>
    );
  }
  return renderInline(line);
}

function renderInline(text: string) {
  const parts: (string | React.ReactNode)[] = [];
  // Order matters: try __underline__ before _italic_
  const regex = /\*\*([^*]+)\*\*|__([^_]+)__|_([^_]+)_/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={match.index}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<u key={match.index}>{match[2]}</u>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
