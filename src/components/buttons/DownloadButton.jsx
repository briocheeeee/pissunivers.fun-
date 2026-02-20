import React from 'react';
import { useSelector } from 'react-redux';
import { MdFileDownload } from 'react-icons/md';
import fileDownload from 'js-file-download';
import { t } from 'ttag';

import { getRenderer } from '../../ui/rendererFactory.js';

/**
 * https://jsfiddle.net/AbdiasSoftware/7PRNN/
 */
function download(view) {
  const renderer = getRenderer();
  const viewport = renderer.getViewport();
  if (!viewport) return;

  const [x, y] = view.map(Math.round);
  const filename = `i love pixuniverse-${x}-${y}.png`;

  viewport.toBlob((blob) => fileDownload(blob, filename));
}


const DownloadButton = () => {
  const view = useSelector((state) => state.canvas.view);

  return (
    <button
      type="button"
      id="downloadbutton"
      className="actionbuttons"
      title={t`Make Screenshot`}
      onClick={() => download(view)}
    >
      <MdFileDownload />
    </button>
  );
};

export default React.memo(DownloadButton);
