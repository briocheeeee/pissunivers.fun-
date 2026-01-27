/**
 * Main App
 */

import React from 'react';
import { Provider } from 'react-redux';
import { createRoot } from 'react-dom/client';
import { IconContext } from 'react-icons';

import Style from './Style.jsx';
import CoordinatesBox from './CoordinatesBox.jsx';
import CanvasSwitchButton from './buttons/CanvasSwitchButton.jsx';
import OnlineBox from './OnlineBox.jsx';
import ChatButton from './buttons/ChatButton.jsx';
import Menu from './Menu.jsx';
import UI from './UI.jsx';
import ExpandMenuButton from './buttons/ExpandMenuButton.jsx';
import WindowManager from './WindowManager.jsx';

const iconContextValue = { style: { verticalAlign: 'middle' } };

const App = () => (
  <>
    <Style />
    <IconContext.Provider value={iconContextValue}>
      <CanvasSwitchButton />
      <Menu />
      <ChatButton />
      <OnlineBox />
      <CoordinatesBox />
      <ExpandMenuButton />
      <UI />
      <WindowManager />
    </IconContext.Provider>
  </>
);

function renderApp(domParent, store) {
  const root = createRoot(domParent);
  root.render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
}

export default renderApp;
