import React from 'react';
import ReactDOM from 'react-dom';
import {Main} from './Main.jsx';

const ROOT_ELEMENT = 'main';

window.onload = function() {
  let root = document.getElementsByTagName(ROOT_ELEMENT)[0];
 
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    //window.location = 'https://jjf.im/mobile';
    return;
  }
  ReactDOM.render(<Main />, root);
}