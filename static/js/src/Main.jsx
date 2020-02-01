import React from 'react';
import ReactDOM from 'react-dom';
import { EditorState, Editor, CompositeDecorator, convertToRaw } from 'draft-js';

const names = ['John Smith', 'Jim Avery', 'Jonas Salk'];

export class Main extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchingNames:false,
      editorState: EditorState.createEmpty()
    }
  }
  
  addSelections(matches) {
    
    
    document.querySelector('.searchResults').innerHTML = '';
    let ul = document.createElement('ul');
    matches.forEach(match => {
      let li = document.createElement('li');
      li.innerHTML = match;
      ul.appendChild(li);
    });
    document.querySelector('.searchResults').appendChild(ul);
    let highlight = document.querySelector('.search-highlight');
    if (highlight) {
      console.log(highlight.offsetLeft);
      document.querySelector('.searchResults').style.left = highlight.offsetLeft + 25 + 'px';
    }
  }
  
  clearSelections() {
    document.querySelector('.searchResults').innerHTML = '';
  }

  onChange = (editorState) => {
    let self = this;
    this.setState({
      editorState:editorState
    });
    const blocks = convertToRaw(editorState.getCurrentContent()).blocks;
    const text = blocks.map(block => (!block.text.trim() && '\n') || block.text).join('\n');
    if (text[text.length-1] == '@') {
      this.setState({
        searchingNames:true
      });
    }
    if (this.state.searchingNames && text.length) {
      //let start = text.lastIndexOf('@');
      var selectionState = editorState.getSelection();
      var anchorKey = selectionState.getFocusKey();
      var currentContent = editorState.getCurrentContent();
      var currentContentBlock = currentContent.getBlockForKey(anchorKey);
      var end = selectionState.getEndOffset();
      let start;
      
      for (let i = end; i >= 0; i--) {
        if (text[i] == '@') {
          start = i;
          break;
        }
      }
      console.log('start', start, end);
      var substr = currentContentBlock.getText().slice(start, start+end);
      //var substr = text.substring(start, end);
      console.log('sub', substr);
      let regex = new RegExp(substr, 'ig');
      let matches = [];
      names.forEach(function (name, index) {
        let search = ('@' + name).match(regex);
        if (search) {
          matches.push(names[index]);
        }
      });
      if (matches.length) {
        if (matches.length == 1 && matches[0].length+1 == end) {
          self.setState({
            searchingNames:false,
            editorState: EditorState.set(editorState, { decorator: self.generateDecorator(start, substr.length, this.FinalizeHighlight)})
          });
          self.clearSelections();
        } else {
          
          self.setState({
            editorState: EditorState.set(editorState, { decorator: self.generateDecorator(start, substr.length, this.SearchHighlight)})
          }, function() {
            setTimeout(function() {
              self.addSelections(matches), 400
          })
          });
          //self.addSelections(matches);
        }
      } else {
        self.clearSelections();
        matches = [];
      }
      
    }
    
  }

  SearchHighlight = (props) => (
    <span className="search-highlight">{props.children}</span>
  );
  FinalizeHighlight = (props) => (
    <span className="found-box">{props.children}</span>
  );


  generateDecorator = (start, end, type) => {
    return new CompositeDecorator([{
      strategy: (contentBlock, callback) => {
        //this.findWithRegex(regex, contentBlock, callback, state, finalized);
        this.echoBack(start, end, callback);
      },
      component: type
    }])
  }
  
  // Pointless but it seems like Draft decorators require a callback
  echoBack = (start, end, callback) => {
    console.log('calling back...', start, 'to', start+end);
    callback(start, start + end);
    
  }
  
  render() {
    return (
      <div>
        <Editor
          editorState={this.state.editorState}
          onChange={this.onChange}
        />
        <div className="searchResults"></div>
      </div>
    );
  }
}