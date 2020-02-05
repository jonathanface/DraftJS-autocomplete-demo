import React from 'react';
import ReactDOM from 'react-dom';
import { EditorState, Editor, SelectionState, CompositeDecorator, Modifier, genKey } from 'draft-js';

const HANDLE_REGEX = /@(\w)+\s?(\w)*/gi
const HASHTAG_REGEX = /#(\w)+/gi
const IDEA_REGEX = /<>(\w)+\s?(\w)*/gi

const names = ['Jim Avery', 'Bob Jenkins', 'Jonas Salk', 'Telly Savalas', 'Aaron Sorkin', 'Robert Untermeyer'];
const hashes = ['BlahBlah', 'Gencon2020', 'HappyBirthday', 'Pokemon', 'ZzZzZzZzZ', '123LetsGo'];
const relations = ['Archaeology', 'History', 'Machine Learning', 'Politics', 'Programming', 'Zoology'];
var suggestions = [];
var activeEditingKey;

export class Main extends React.Component {
  constructor() {
    super();
    const compositeDecorator = new CompositeDecorator([
      {
        strategy: this.person.bind(this),
        component: this.PersonSpan,
      },
      {
        strategy: this.hashtag.bind(this),
        component: this.HashtagSpan,
      },
      {
        strategy: this.relation.bind(this),
        component: this.RelationSpan,
      },
      {
        strategy: this.getEntityStrategy('IMMUTABLE_PERSON').bind(this),
        component: this.FinalizedPersonSpan
      },
      {
        strategy: this.getEntityStrategy('IMMUTABLE_HASHTAG').bind(this),
        component: this.FinalizedHashtagSpan
      },
      {
        strategy: this.getEntityStrategy('IMMUTABLE_RELATION').bind(this),
        component: this.FinalizedRelationSpan
      }
    ]);

    this.state = {
      editorState: EditorState.createEmpty(compositeDecorator),
      tagIndex:0,
      browsingSuggestions:false,
      searchCount:0
    };

    this.focus = () => this.refs.editor.focus();
    this.onChange = (editorState) => this.setState({editorState});
    
  }
  
  componentDidMount() {
    document.querySelectorAll('.info span')[0].innerHTML = JSON.stringify(names, undefined, 2);
    document.querySelectorAll('.info span')[1].innerHTML = JSON.stringify(hashes, undefined, 2);
    document.querySelectorAll('.info span')[2].innerHTML = JSON.stringify(relations, undefined, 2);
  }
  
  
  // If down arrow is pressed, and the list is not being browsed, go to the first option.
  // If we're at the bottom of the list, return focus to the editor.
  // Otherwise, jump down the list.
  onDownArrow(event) {
    event.preventDefault();
    if (suggestions.length) {
      if (this.state.tagIndex > suggestions.length-1) {
        this.setState({
          tagIndex:0,
          browsingSuggestions:false
        });
        this.focus();
        return;
      }
      this.state.browsingSuggestions = true;
      let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
      currSpan.focus();
      this.state.tagIndex++;
      
    }
  }
  
  // If up arrow is pressed, and the list is not being browsed, go to the last option.
  // If we're at the top of the list, return focus to the editor.
  // Otherwise, jump up the list.
  onUpArrow(event) {
    event.preventDefault();
    if (suggestions.length) {
      if (!this.state.browsingSuggestions) {
        this.state.tagIndex = suggestions.length-1;
        this.state.browsingSuggestions = true;
        let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
        currSpan.focus();
      } else {
        if (this.state.tagIndex <= 0) {
          this.state.tagIndex = 0;
          this.state.browsingSuggestions = false;
          this.focus();
          return;
        }
        this.state.tagIndex--;
        let currSpan = document.querySelectorAll('.searchResults li')[this.state.tagIndex];
        currSpan.focus();
      }
    }
  }
  
  // Handler for both enter and tab keys.
  onEnter(event) {
    event.preventDefault();
    if (this.state.browsingSuggestions) {
      this.setState({
        tagIndex:0,
        browsingSuggestions:false
      });
      console.log(event.target);
      this.finalizeText(event.target.innerText, event.target.classList[0]);
    }
  }
  
  // User has entered text which matches something in one of our lists.
  // We will style it and make it immutable.
  finalizeText(text, type) {
    console.log('finalizing for', type);
    let contentState = this.state.editorState.getCurrentContent();
    let selectionState = this.state.editorState.getSelection();
    const block = contentState.getBlockForKey(selectionState.getAnchorKey());
    
    // Find the delimiter to use as anchor start point.
    let anchorPoint = 0;
    let delimiter = '';
    let immutableType = '';
    switch(type) {
      case 'person':
        immutableType = 'IMMUTABLE_PERSON';
        delimiter = '@';
        break;
      case 'hashtag':
        immutableType = 'IMMUTABLE_HASHTAG';
        delimiter = '#';
        break;
      case 'relation':
        immutableType = 'IMMUTABLE_RELATION';
        delimiter = '>';
        break;
    }

    // Start at the cursor and loop backwards until we find our delimiter character.
    for (let i=selectionState.focusOffset; i >=0; i--) {
      if (block.text[i] == delimiter) {
        if (type == 'relation') {
          if (block.text[i-1] == '<') {
            anchorPoint = i-1;
          }
        } else {
          anchorPoint = i;
        }
        break;
      }
    }
    
    // Select our range and replace it with the properly formatted text from our list.
    let newSelectionState = new SelectionState({
      anchorKey: block.getKey(),
      anchorOffset: anchorPoint,
      focusKey: block.getKey(),
      focusOffset: selectionState.focusOffset,
    });
    contentState = Modifier.replaceText(
      contentState,
      newSelectionState,
      text
    );
    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        contentState,
      )
    });

    // Make the formatted text immutable and give it styles.
    let newBlock = contentState.getBlockForKey(newSelectionState.getAnchorKey());
    newSelectionState = new SelectionState({
      anchorKey: newBlock.getKey(),
      anchorOffset: anchorPoint,
      focusKey: newBlock.getKey(),
      focusOffset: anchorPoint + text.length
    });
    let newContentState = contentState.createEntity('TOKEN', immutableType, {url:''});
    const entityKey = contentState.getLastCreatedEntityKey();
    newContentState = Modifier.applyEntity(
      newContentState,
      newSelectionState,
      entityKey
    );
    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        newContentState,
      )
    });

    // Shift focus to end of our entry, and add a single whitespace.
    const focusSelection = newSelectionState.merge({
      anchorOffset: anchorPoint + text.length,
      focusOffset: anchorPoint + text.length,
    });
    const newEditorState = EditorState.forceSelection(
      this.state.editorState,
      focusSelection
    );
    this.setState({ editorState: newEditorState });
    let cs = Modifier.insertText(
      this.state.editorState.getCurrentContent(),
      focusSelection,
      ' '
    );
    const spaced = EditorState.push(
        this.state.editorState,
        cs,
        ''
      );
    this.setState({ editorState: spaced });
    this.clearSelections();
    this.focus();
  }

  // button handlers for the list options
  handleSuggestionPress(event) {
    event.preventDefault();
    switch(event.key) {
      case 'ArrowDown':
        this.onDownArrow(event);
        break;
      case 'ArrowUp':
        this.onUpArrow(event);
        break;
      case 'Tab':
      case 'Enter':
        this.onEnter(event);
        break;
    }
  }
  
  // Generate the selectable dropdown from the matched user input.
  addSelections(type) {
    let self = this;
    let ul = document.querySelector('.searchResults ul');
    if (ul) {
      ul.innerHTML = '';
      suggestions.forEach(function(match, index) {
        let newLI = document.createElement('li');
        newLI.classList.add(type);
        newLI.tabIndex = index;
        newLI.onkeydown = self.handleSuggestionPress.bind(self);
        newLI.innerHTML = match;
        newLI.onclick = function(event) {
          self.state.browsingSuggestions = true;
          self.onEnter(event);
        }
        ul.appendChild(newLI);
      });
    } else {
      ul = document.createElement('ul');
      suggestions.forEach(function(match, index) {
        let li = document.createElement('li');
        li.classList.add(type);
        li.tabIndex = index;
        li.onkeydown = self.handleSuggestionPress.bind(self);
        li.innerHTML = match;
        li.onclick = function(event) {
          self.state.browsingSuggestions = true;
          self.onEnter(event);
        }
        ul.appendChild(li);
      });
      document.querySelector('.searchResults').appendChild(ul);
    }
    document.querySelector('.searchResults').classList.remove('person');
    document.querySelector('.searchResults').classList.remove('hashtag');
    document.querySelector('.searchResults').classList.remove('relation');
    document.querySelector('.searchResults').classList.add(type);
    // This is a little hacky but you have to delay for both the state to update
    // and for the list to figure out where it should be placed horizontally.
    // Otherwise you can see it jerking around on screen. Sure there is a better way.
    setTimeout(function() {
      console.log('key', activeEditingKey);
      let highlight = document.querySelector('.' + type + '[data-matchkey="' + activeEditingKey + '"]');
      if (highlight) {
        document.querySelector('.searchResults').style.left = highlight.offsetLeft + 27 + 'px';
      } else {
        document.querySelector('.searchResults').style.left = '27px';
      }
      document.querySelector('.searchResults').style.opacity = 1;
    }, 50);
  }
  
  // Remove the list box.
  clearSelections(className) {
    if (document.querySelector('.searchResults').classList.contains(className)) {
      if (document.querySelector('.searchResults ul')) {
        document.querySelector('.searchResults ul').innerHTML = '';
      }
      document.querySelector('.searchResults').style.opacity = 0;
    }
  }
  
  // Matching type person, indicated by @ character.
  person(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    let self = this;
    let exactMatch = null;
    while ((matchArr = HANDLE_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + matchArr[0].length;
      textSlice = text.slice(start+1, end).trim();
      let regex = new RegExp('^'+textSlice, 'ig');
      matches = [];
      names.forEach(function (name, index) {
        if (name.toLowerCase() == textSlice.toLowerCase()) {
          matchArr = null;
          exactMatch = name;
        } else {
          let search = name.match(regex);
          if (search) {
            matches.push(name);
          }
        }
      });
    }
    
    if (exactMatch) {
      //have to delay a bit so onchange can update state
      setTimeout(function() {
        self.finalizeText(exactMatch, 'person');
      }, 50);
      return;
    }
    if (matches.length) {
      suggestions = [...new Set(matches)];
      this.addSelections('person');
    } else {
      this.clearSelections('person');
    }
    this.findWithRegex(HANDLE_REGEX, contentBlock, callback, 'person');
  }

  // Matching type hashtag indicated by # character.
  hashtag(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    let self = this;
    let exactMatch = null;
    while ((matchArr = HASHTAG_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + matchArr[0].length;
      textSlice = text.slice(start+1, end);
      let regex = new RegExp('^'+textSlice, 'ig');
      matches = [];
      hashes.forEach(function (hash, index) {
        if (hash.toLowerCase() == textSlice.toLowerCase()) {
          matchArr = null;
          exactMatch = hash;
        } else {
          let search = hash.match(regex);
          if (search) {
            matches.push(hash);
          }
        }
      });
    }
    if (exactMatch) {
      //have to delay a bit so onchange can update state
      setTimeout(function() {
        self.finalizeText(exactMatch, 'hashtag');
      }, 50);
      return;
    }
    if (matches.length) {
      suggestions = [...new Set(matches)];
      this.addSelections('hashtag');
    } else {
      this.clearSelections('hashtag');
    }
    this.findWithRegex(HASHTAG_REGEX, contentBlock, callback);
  }

  // Matching type relation indicated by '<>' characters.
  relation(contentBlock, callback, contentState) {
    const text = contentBlock.getText();
    let start, matchArr, matches = [];
    let textSlice = '';
    let self = this;
    let exactMatch = null;
    while ((matchArr = IDEA_REGEX.exec(text)) !== null) {
      start = matchArr.index;
      let end = start + matchArr[0].length;
      textSlice = text.slice(start+2, end).trim();
      let regex = new RegExp('^'+textSlice, 'ig');
      matches = [];
      relations.forEach(function (relation, index) {
        if (relation.toLowerCase() == textSlice.toLowerCase()) {
          matchArr = null;
          exactMatch = relation;
        } else {
          let search = relation.match(regex);
          if (search) {
            matches.push(relation);
          }
        }
      });
    }

    if (exactMatch) {
      //have to delay a bit so onchange can update state
      setTimeout(function() {
        self.finalizeText(exactMatch, 'relation');
      }, 50);
      return;
    }
    if (matches.length) {
      suggestions = [...new Set(matches)];
      this.addSelections('relation');
    } else {
      this.clearSelections('relation');
    }
    this.findWithRegex(IDEA_REGEX, contentBlock, callback);
  }

  // callback to render immutable entities
  getEntityStrategy(mutability) {
    return function(contentBlock, callback, contentState) {
      contentBlock.findEntityRanges((character) => {
        const entityKey = character.getEntity();
        if (entityKey === null) {
          return false;
        }
        return contentState.getEntity(entityKey).getMutability() === mutability;
      }, callback);
    };
  }

  findWithRegex(regex, contentBlock, callback) {
    const text = contentBlock.getText();
    let self = this;
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
      start = matchArr.index;
      callback(start, start + matchArr[0].length);
    }
  }

  PersonSpan = (props) => {
    // This is wrong and apt to cause issues later, but right now
    // it isn't clear to me how to access a decorator's offsetkey
    activeEditingKey = genKey();
    return (
      <span
        className='person'
        data-offset-key={props.offsetKey}
        data-matchkey={activeEditingKey}
        >
        {props.children}
      </span>
    );
  };

  HashtagSpan = (props) => {
    // This is wrong and apt to cause issues later, but right now
    // it isn't clear to me how to access a decorator's offsetkey
    activeEditingKey = genKey();
    return (
      <span
        className="hashtag"
        data-offset-key={props.offsetKey}
        data-matchkey={activeEditingKey}
        >
        {props.children}
      </span>
    );
  };

  RelationSpan = (props) => {
    // This is wrong and apt to cause issues later, but right now
    // it isn't clear to me how to access a decorator's offsetkey
    activeEditingKey = genKey();
    return (
      <span
        className="relation"
        data-offset-key={props.offsetKey}
        data-matchkey={activeEditingKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizedPersonSpan = (props) => {
    return (
      <span
        className={'final person'}
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizedHashtagSpan = (props) => {
    return (
      <span
        className={'final hashtag'}
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };
  
  FinalizedRelationSpan = (props) => {
    return (
      <span
        className={'final relation'}
        data-offset-key={props.offsetKey}
        >
        {props.children}
      </span>
    );
  };

  render() {
    return (
      <div>
        
        <div onClick={this.focus} className="editorContainer">
          <Editor
            onDownArrow={this.onDownArrow.bind(this)}
            onUpArrow={this.onUpArrow.bind(this)}
            editorState={this.state.editorState}
            onChange={this.onChange}
            placeholder="Write something..."
            ref="editor"
            />
        </div>
        <div className="searchResults"></div>
        <div className="info"><h4>Available Names:</h4><span className="nameDisplay"></span></div>
        <div className="info"><h4>Available Hashtags:</h4><span className="hashDisplay"></span></div>
        <div className="info"><h4>Available Relations:</h4><span className="relationsDisplay"></span></div>
      </div>
    );
  }
}

