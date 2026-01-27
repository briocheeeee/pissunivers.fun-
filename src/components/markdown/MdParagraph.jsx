/*
 * Renders Markdown that got parsed by core/MarkdownParser
 */
import React from 'react';

import MdLink from './MdLink.jsx';
import MdMention from './MdMention.jsx';
import MdLocalMedia from './MdLocalMedia.jsx';
import { parseParagraph } from '../../utils/markdown/MarkdownParser.js';

/**
 * parse a markdown paragraph,
 * either text or pArray should be given, not both
 * @param {
 *   text: markdown text
 *   pArray: parsed markdown array
 *   refEmbed: a reference to the element where we can attach an embed to
 * }
 */
const MdParagraph = ({ text, pArray, refEmbed }) => {
  if (!pArray) {
    if (!text) {
      return null;
    }
    pArray = parseParagraph(text);
  }

  return pArray.map((part) => {
    if (!Array.isArray(part)) {
      return part;
    }
    const type = part[0];
    switch (type) {
      case 'c':
        return (<code>{part[1]}</code>);
      case '*':
        return (
          <strong>
            <MdParagraph pArray={part[1]} />
          </strong>
        );
      case '~':
        return (
          <s>
            <MdParagraph pArray={part[1]} />
          </s>
        );
      case '+':
        return (
          <em>
            <MdParagraph pArray={part[1]} />
          </em>
        );
      case '_':
        return (
          <u>
            <MdParagraph pArray={part[1]} />
          </u>
        );
      case 'img': {
        const link = part[2];
        if (link.startsWith('/m/') && link) {
          return (
            <MdLocalMedia refEmbed={refEmbed} href={part[2]} title={part[1]} />
          );
        }
        return (
          <MdLink refEmbed={refEmbed} href={part[2]} title={part[1]} />
        );
      }
      case 'l':
        return (
          <MdLink refEmbed={refEmbed} href={part[2]} title={part[1]} />
        );
      case '@':
        return (
          <MdMention uid={part[2]} name={part[1]} />
        );
      default:
        return type;
    }
  });
};

export default React.memo(MdParagraph);
