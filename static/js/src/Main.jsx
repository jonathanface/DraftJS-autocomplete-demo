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
    if (text[text.length-1] == '@' && !this.state.searchingNames) {
      this.setState({
        searchingNames:true
      });
    }
    console.log('change');
    if (this.state.searchingNames && text.length) {
      let start = text.lastIndexOf('@');
      var substr = text.substring(start, text.length);
      let regex = new RegExp(substr, 'ig');
      let matches = [];
      names.forEach(function (name, index) {
        let search = ('@' + name).match(regex);
        if (search) {
          matches.push(names[index]);
        }
      });
      if (matches.length) {
        self.addSelections(matches);
        self.setState({
          editorState: EditorState.set(editorState, { decorator: self.generateDecorator(substr, self.SearchHighlight, editorState, false)})
        });
        return;
      } else {
        self.clearSelections();
        matches = [];
      }
    }
    
  }

  SearchHighlight = (props) => (
    <span className="search-highlight">{props.children}</span>
  );
  
  NameSpan = (props) => {
    return (
      <span {...props} style={styles.found-box}>
        {props.children}
      </span>
    );
  }

  generateDecorator = (regex, type, state, finalized) => {
    return new CompositeDecorator([{
      strategy: (contentBlock, callback) => {
        this.findWithRegex(regex, contentBlock, callback, state, finalized);
      },
      component: type,
    }])
  }
  
  findWithRegex = (regex, contentBlock, callback, state, finalized) => {
    let self = this;
    const text = contentBlock.getText();
    regex = new RegExp(regex, 'ig');
    //console.log('searching', text, 'for', regex);
    let match, start, end;
    
    let lastpos = text.lastIndexOf('@');
    let matchText = '';
    while ((match = regex.exec(text)) != null) {
      start = match.index;
      if (start == lastpos) {
        names.forEach(function (name, index) {
          if ('@' + name.toLowerCase() == match[0].toLowerCase()) {
            matchText = match[0];
            return;
          }
        });
        callback(start, start + match[0].length);
        if (matchText.length) {
          self.setState({
            searchingNames:false
          });
          break;
        }
        
      }
    }
    if (matchText.length) {
      console.log('found', matchText);
      self.clearSelections();
      
      console.log('final pass', finalized);
      if (!finalized) {
        console.log('change to blue');
        /*
        self.setState({
          editorState: EditorState.set(state, { decorator: self.generateDecorator(regex, self.NameSpan, state, true)})
        });
        */
        return;
      }
      return;
    }
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