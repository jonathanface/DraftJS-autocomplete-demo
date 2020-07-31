import React from 'react';
import ReactDOM from 'react-dom';
import {EditorState, Editor, SelectionState, CompositeDecorator, Modifier} from 'draft-js';

const HANDLE_REGEX = /@(\w)+( |\t)?(\w)*(?!(@#<))/gi
const HASHTAG_REGEX = /#(\w)+(?!(<#@))*/gi
const IDEA_REGEX = /<>(\w)+( |\t)?(\w)*(?!(@#<))/gi

const PERSON_TYPE = 'person';
const HASHTAG_TYPE = 'hashtag';
const RELATION_TYPE = 'relation';
const IMMUTABLE_TYPE = 'IMMUTABLE';
const MUTABLE_TYPE = 'MUTABLE';

const names = ['Jim Avery', 'Bob Jenkins', 'Jonas Salk', 'Telly Savalas', 'Aaron Sorkin', 'Robert Untermeyer'];
const hashes = ['BlahBlah', 'Gencon2020', 'HappyBirthday', 'Pokemon', 'ZzZzZzZzZ', '123LetsGo'];
const relations = ['Archaeology', 'History', 'Machine Learning', 'Politics', 'Programming', 'Zoology'];

var activeEditingKey;
var searchList = React.createRef();
var searchListDOM = React.createRef();
var editMap = {};

const ListItem = React.forwardRef((props, ref) => (<li tabIndex={props.tabIndex} onClick={props.onClick} onKeyDown={props.onKeyDown} ref={ref}>{props.value}</li>));
export class SearchList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      items:props.items,
      searchVisible:0
    }
    this.onItemClick = props.onItemClick;
    this.onItemPress = props.onItemPress;
  }
  
  liRefs = {};

  static getDerivedStateFromProps(props, prevState) {
    if (prevState.items != props.items) {
      return {
        items: props.items
      };
    }
    return null;
  }

  render() {
    return(
      <ul ref={searchListDOM} style={{opacity:this.state.searchVisible}}>
        {this.state.items.map((item, index ) => {
          this.liRefs[index] = React.createRef();
          return (
            <ListItem key={index} tabIndex={index} ref={this.liRefs[index]} value={item} onClick={this.onItemClick} onKeyDown={this.onItemPress}/>
          );
        })}
      </ul>
    );
  }
}

export class Main extends React.Component {
  constructor() {
    super();
    this.state = {
      suggestions: []
    };
    
    this.compositeDecorator = new CompositeDecorator([
      {
        strategy: this.person.bind(this),
        component: ColorMatchSpan,
        props: {
          'type': PERSON_TYPE,
          'getSuggestions':this.getSuggestionsLength.bind(this),
          'updateContentStateFromChild':this.updateContentStateFromChild.bind(this)
        }
      },
      {
        strategy: this.hashtag.bind(this),
        component: ColorMatchSpan,
        props: {
          'type': HASHTAG_TYPE,
          'getSuggestions':this.getSuggestionsLength.bind(this)
        }
      },
      {
        strategy: this.relation.bind(this),
        component: ColorMatchSpan,
        props: {
          'type': RELATION_TYPE,
          'getSuggestions':this.getSuggestionsLength.bind(this)
        }
      },
      {
        strategy: this.getImmutableEntityStrategy(PERSON_TYPE).bind(this),
        component: FinalizedSpan,
        props: {
          'type': PERSON_TYPE,
          'updateContentStateFromChild':this.updateContentStateFromChild.bind(this)
        }
      },
      {
        strategy: this.getImmutableEntityStrategy(HASHTAG_TYPE).bind(this),
        component: FinalizedSpan,
        props: {
          'type': HASHTAG_TYPE,
          'updateContentStateFromChild':this.updateContentStateFromChild.bind(this)
        }
      },
      {
        strategy: this.getImmutableEntityStrategy(RELATION_TYPE).bind(this),
        component: FinalizedSpan,
        props: {
          'type': RELATION_TYPE,
          'updateContentStateFromChild':this.updateContentStateFromChild.bind(this)
        }
      },
    ]);
    
    this.suggestionsType = null;
    this.focus = () => this.refs.editor.focus();
    this.onChange = (editorState) => this.setState({editorState});
    
    this.tagIndex=-1;
    this.browsingSuggestions = false;
  }
  
  updateContentStateFromChild(contentState) {
    console.log('update from child');
    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        contentState
      )
    });
  }
  
  getSuggestionsLength() {
    return this.state.suggestions.length;
  }
  
  componentDidMount() {
    document.querySelectorAll('.info span')[0].innerHTML = JSON.stringify(names, undefined, 2);
    document.querySelectorAll('.info span')[1].innerHTML = JSON.stringify(hashes, undefined, 2);
    document.querySelectorAll('.info span')[2].innerHTML = JSON.stringify(relations, undefined, 2);
  }
  
  componentWillMount() {
    this.setState({
      editorState: EditorState.createEmpty(this.compositeDecorator),
    });
  }
  
  
  // If down arrow is pressed, and the list is not being browsed, go to the first option.
  // If we're at the bottom of the list, jump back up to the top.
  // Otherwise, jump down the list.
  onDownArrow(event) {
    event.preventDefault();
    if (this.state.suggestions.length) {
      if (this.tagIndex >= this.state.suggestions.length-1) {
        this.tagIndex = -1;
      }
      this.tagIndex++;
      this.browsingSuggestions = true;
      searchList.current.liRefs[this.tagIndex].current.focus();
      
    }
  }
  
  // If up arrow is pressed, and the list is not being browsed, go to the last option.
  // If we're at the top of the list, jump to the bottom.
  // Otherwise, jump up the list.
  onUpArrow(event) {
    event.preventDefault();
    if (this.state.suggestions.length) {
      if (this.tagIndex <= 0) {
        this.tagIndex = this.state.suggestions.length;
      }
      this.tagIndex--;
      console.log('ind', this.tagIndex);
      this.browsingSuggestions = true;
      searchList.current.liRefs[this.tagIndex].current.focus();
    }
  }
  
  // Handler for both enter and tab keys.
  onEnter(event) {
    event.preventDefault();
    if (this.browsingSuggestions) {
      this.tagIndex = -1;
      this.browsingSuggestions = false;
      this.finalizeText(event.target.innerText, this.suggestionsType);
    }
  }
  
  handleKeyCommand(command) {
    if (command == 'split-block') {
      this.clearSelections(PERSON_TYPE);
      this.clearSelections(HASHTAG_TYPE);
      this.clearSelections(RELATION_TYPE);
    }
  }
  
  // User has entered text which matches something in one of our lists.
  // We will style it and make it immutable.
  finalizeText(text, type) {
    this.clearSelections(type);
    this.focus();
    
    let contentState = this.state.editorState.getCurrentContent();
    let selectionState = this.state.editorState.getSelection();
    const block = contentState.getBlockForKey(selectionState.getAnchorKey());
    
    // Find the delimiter to use as anchor start point.
    let anchorPoint = 0;
    let delimiter = '';
    
    switch(type) {
      case PERSON_TYPE:
        delimiter = '@';
        break;
      case HASHTAG_TYPE:
        delimiter = '#';
        break;
      case RELATION_TYPE:
        delimiter = '>';
        break;
    }

    // Start at the cursor and loop backwards until we find our delimiter character.
    for (let i=selectionState.focusOffset; i >=0; i--) {
      if (block.text[i] == delimiter) {
        if (type == RELATION_TYPE) {
          if (block.text[i-1] == '<') {
            anchorPoint = i-1;
          }
        } else {
          anchorPoint = i;
        }
        break;
      }
    }
    console.log('anch', anchorPoint);
    
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
      text + ' '
    );
    this.setState({
      editorState: EditorState.push(
        this.state.editorState,
        contentState,
      )
    }, function() {
      
      // Make the formatted text immutable and give it styles.
      let newBlock = contentState.getBlockForKey(newSelectionState.getAnchorKey());
      newSelectionState = new SelectionState({
        anchorKey: newBlock.getKey(),
        anchorOffset: anchorPoint,
        focusKey: newBlock.getKey(),
        focusOffset: anchorPoint + text.length
      });
      let newContentState = contentState.createEntity(
        type,
        IMMUTABLE_TYPE,
        {'ignored':true}
      );
      const entityKey = newContentState.getLastCreatedEntityKey();
      newContentState = Modifier.applyEntity(
        contentState,
        newSelectionState,
        entityKey
      );
      this.setState({
        editorState: EditorState.push(
          this.state.editorState,
          newContentState,
        )
      }, function() {
        const focusSelection = newSelectionState.merge({
          anchorOffset: anchorPoint + text.length+1,
          focusOffset: anchorPoint + text.length+1,
        });
        const newEditorState = EditorState.forceSelection(
          this.state.editorState,
          focusSelection
        );
        this.setState({ editorState: newEditorState });
      });
    });
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
  
  // click handler for the list options
  handleSuggestionClick(event) {
    event.preventDefault();
    this.browsingSuggestions = true;
    this.onEnter(event);
  }
  

  
  // Generate the selectable dropdown from the matched user input.
  addSelections(type) {
    const selectionState = this.state.editorState.getSelection();
    let focus = selectionState.focusOffset;
    setTimeout(function() {
      /*
      if (!(focus >= editMap[activeEditingKey].start && focus <= editMap[activeEditingKey].end)) {
        console.log(editMap[activeEditingKey]);
        console.log(focus, ' out of range for ', editMap[activeEditingKey].start, + ' and ' + editMap[activeEditingKey].end);
        return;
      }*/
      let ul = searchListDOM.current;
      if (!searchList.current.state.searchVisible) { 
          let highlight = document.querySelector('.' + type + '[data-offset-key="' + activeEditingKey + '"][data-start="' + editMap[activeEditingKey].start + '"]');
          if (highlight) {
            ul.style.left = highlight.offsetLeft + 27 + 'px';
            ul.style.top = 100 + highlight.parentNode.parentNode.offsetTop + 40 + 'px';
          } else {
            ul.style.left = '27px';
            ul.style.top = 100 + 40 + 'px';
          }
          
        searchList.current.setState({
          searchVisible:1
        });
      }
    }, 50);
  }
  
  // Remove the list box.
  clearSelections(type) {
    if (type == this.suggestionsType) {
      this.setState({
        suggestions:[]
      });
      searchList.current.setState({
        searchVisible:0
      });
    }
  }
  
  getSuggestions(contentBlock, contentState, type) {
    let regex, suggestionsArr, startOffset = 1, delimiter='';
    switch(type) {
      case PERSON_TYPE:
        regex = HANDLE_REGEX;
        suggestionsArr = names;
        delimiter = '@';
        break;
      case HASHTAG_TYPE:
        regex = HASHTAG_REGEX;
        suggestionsArr = hashes;
        delimiter = '#';
        break;
      case RELATION_TYPE:
        regex = IDEA_REGEX;
        suggestionsArr = relations;
        delimiter = '>';
        startOffset = 2;
        break;
    }
    
    const selection = this.state.editorState.getSelection();
    let anchorPoint=null;
    const text = contentBlock.getText();
    for (let i=selection.focusOffset; i >= 0; i--) {
      switch(type) {
        case PERSON_TYPE:
          if (text[i] == '#' || text[i] == '>') {
            return;
          }
          break;
        case HASHTAG_TYPE:
          if (text[i] == '@' || text[i] == '>') {
            return;
          }
          break;
        case RELATION_TYPE:
          if (text[i] == '@' || text[i] == '#') {
            return;
          }
          break;
      }
      
      if (text[i] == delimiter) {
        if (type == RELATION_TYPE) {
          if (text[i-1] == '<') {
            anchorPoint = i-1;
          }
        } else {
          anchorPoint = i;
        }
        break;
      }
    }
    let textSlice = text.slice(anchorPoint, text.length).trim();
    let matchArr, matches = [];
    let reg = new RegExp(regex);
    if (textSlice.length) {
      while ((matchArr = reg.exec(textSlice)) !== null) {
        this.clearSelections(type);
        let start = anchorPoint;
        let end = start + matchArr[0].length;
        let entpos = this.checkForEntity(contentBlock, contentState, start, end);
        if (entpos !== null) {
          end = entpos;
        }
        let subSlice = textSlice.slice(startOffset, end).trim();
        let subregex = new RegExp('^'+subSlice, 'ig');
        let exactMatch = null;
        suggestionsArr.forEach(function (suggestion, index) {
          if (suggestion.toLowerCase() == subSlice.toLowerCase()) {
            exactMatch = suggestion;
          } else {
            let search = suggestion.match(subregex);
            if (search) {
              matches.push(suggestion);
            }
          }
        });
        if (exactMatch) {
          return exactMatch;
        }
        return matches;
      }
    }
    return null;
  }
  
  // Matching type person, indicated by @ character.
  person(contentBlock, callback, contentState) {
    let list = this.getSuggestions(contentBlock, contentState, PERSON_TYPE);
    if (list) {
      this.suggestionsType = PERSON_TYPE;
      if (!Array.isArray(list)) {
        this.finalizeText(list, PERSON_TYPE);
      } else {
        if (list.length) {
          this.setState({
            suggestions:[...new Set(list)]
          });
          this.addSelections(PERSON_TYPE);
        } else {
          this.clearSelections(PERSON_TYPE);
        }
      }
    } else {
      this.clearSelections(PERSON_TYPE);
    }
    this.findWithRegex(HANDLE_REGEX, contentBlock, callback, contentState);
  }

  // Matching type hashtag indicated by # character.
  hashtag(contentBlock, callback, contentState) {
    let list = this.getSuggestions(contentBlock, contentState, HASHTAG_TYPE);
    if (list) {
      this.suggestionsType = HASHTAG_TYPE;
      if (!Array.isArray(list)) {
        this.finalizeText(list, HASHTAG_TYPE);
      } else {
        if (list.length) {
          this.setState({
            suggestions:[...new Set(list)]
          });
          this.addSelections(HASHTAG_TYPE);
        } else {
          this.clearSelections(HASHTAG_TYPE);
        }
      }
    } else {
     this.clearSelections(HASHTAG_TYPE);
    }
    this.findWithRegex(HASHTAG_REGEX, contentBlock, callback, contentState);
  }

  // Matching type relation indicated by '<>' characters.
  relation(contentBlock, callback, contentState) {
    let list = this.getSuggestions(contentBlock, contentState, RELATION_TYPE);
    if (list) {
      this.suggestionsType = RELATION_TYPE;
      if (!Array.isArray(list)) {
        this.finalizeText(list, RELATION_TYPE);
      } else {
        if (list.length) {
          this.setState({
            suggestions:[...new Set(list)]
          });
          this.addSelections(RELATION_TYPE);
        } else {
          this.clearSelections(RELATION_TYPE);
        }
      }
    } else {
      this.clearSelections(RELATION_TYPE);
    }
    this.findWithRegex(IDEA_REGEX, contentBlock, callback, contentState);
  }

  // callback to render immutable entities
  getImmutableEntityStrategy(type) {
    return function(contentBlock, callback, contentState) {
      contentBlock.findEntityRanges((character) => {
        const entityKey = character.getEntity();
        if (entityKey === null) {
          return false;
        }
        return (contentState.getEntity(entityKey).getMutability() === IMMUTABLE_TYPE && contentState.getEntity(entityKey).type == type)
      }, callback);
    };
  }
  
  //This is to make sure our regex doesn't search into adjacent finalized text blocks
  checkForEntity(contentBlock, contentState, start, end) {
    let entStart = null;
    for (let i=start; i < end; i++) {
      let entKey = contentBlock.getEntityAt(i);
      console.log('found entkey', entKey);
      if (entKey) {
        let ent = contentState.getEntity(entKey);
        console.log(ent.data);
        if (ent.data.ignored) {
          console.warn("SEARCHING INTO FINALIZED TEXT BLOCK");
          entStart = i;
          break;
        }
      }
    }
    return entStart;
  }

  findWithRegex(regex, contentBlock, callback, contentState ) {
    const text = contentBlock.getText();
    let match;
    regex = new RegExp(regex);
    let selectionState = this.state.editorState.getSelection();

    while ((match = regex.exec(text)) !== null) {
      console.log('found ', match);
      let start = match.index;
      let end = start + match[0].length;
      
      let entpos = this.checkForEntity(contentBlock, contentState, start, end);
      if (entpos) {
        end=entpos;
        let newSelection = new SelectionState({
          anchorKey: contentBlock.blockKey,
          anchorOffset: start,
          focusKey: contentBlock.blockKey,
          focusOffset: end
        });
        let matchText = '';
        for (let i=start; i < end; i++) {
          matchText += text[i];
        }
        let newContentState = Modifier.replaceText(
          contentState,
          newSelection,
          matchText
        );
        const block = newContentState.getBlockForKey(newSelection.getAnchorKey());
        console.log('modded: ', block.getText());
        //return this.findWithRegex(regex, block, callback, contentState);
      }
      
      //console.log('styling text: ' + matchText);
      console.log('start', start, 'end', end);
      callback(start, end);
    }
  }

  render() {
    
    return (
      <div>
        <div onClick={this.focus} className="editorContainer">
          <Editor
            handleKeyCommand={this.handleKeyCommand.bind(this)}
            onDownArrow={this.onDownArrow.bind(this)}
            onUpArrow={this.onUpArrow.bind(this)}
            editorState={this.state.editorState}
            onChange={this.onChange}
            placeholder="Write something..."
            ref="editor"
            />
        </div>
        <SearchList ref={searchList} items={this.state.suggestions} onItemClick={this.handleSuggestionClick.bind(this)} onItemPress={this.handleSuggestionPress.bind(this)}></SearchList>
        <div className="info"><h4>Available Names:</h4><span className="nameDisplay"></span></div>
        <div className="info"><h4>Available Hashtags:</h4><span className="hashDisplay"></span></div>
        <div className="info"><h4>Available Relations:</h4><span className="relationsDisplay"></span></div>
      </div>
    );
  }
  
  
}



class ColorMatchSpan extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      matches: props.getSuggestions(),
      offsetKey:props.offsetKey,
      start:props.start,
      end:props.end,
      type:props.type,
      pClass: props.getSuggestions() ? props.type : 'entityNotFound'
    };
    
   
    activeEditingKey = props.offsetKey;
    
    editMap[activeEditingKey] = {'start':props.start, 'end':props.end};
    console.log('new block start', props.start);
    console.log('new block end', props.end);
    
  }
  static getDerivedStateFromProps = (props, state) => {
    let returnState = {};
    if (props.getSuggestions() != state.matches) {
      returnState.matches=props.getSuggestions();
      returnState.pClass=props.getSuggestions() ? state.type : 'entityNotFound';
    }
    if (props.end != state.end) {
      editMap[activeEditingKey] = {'start':props.start, 'end':props.end};
      returnState.end = props.end;
    }
    if (props.start != state.start) {
      editMap[activeEditingKey] = {'start':props.start, 'end':props.end};
      returnState.end = props.end;
    }
    if (Object.entries(returnState).length) {
      return returnState;
    }

    return null;
  }
  
  render() {
    return (
      <span className={this.state.pClass} data-offset-key={activeEditingKey} data-start={this.state.start} data-end={this.state.end}>
        {this.props.children}
      </span>
    );
  }
};

class FinalizedSpan extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      render:true,
      type:props.type
    };
  }
  
  deleteThis() {
    //I have to blank the text field before hiding it, because the hidden
    //text can mess with the regex search, so here I make it mutable again,
    //wipe it, and then hide the component.
    let newSelectionState = new SelectionState({
      anchorKey: this.props.blockKey,
      anchorOffset: this.props.start,
      focusKey: this.props.blockKey,
      focusOffset: this.props.start + this.props.decoratedText.length,
    });
    let newContentState = this.props.contentState.createEntity(
      this.props.type,
      MUTABLE_TYPE,
      {'ignored':true}
    );
    const entityKey = newContentState.getLastCreatedEntityKey();
    newContentState = Modifier.applyEntity(
      newContentState,
      newSelectionState,
      entityKey
    );

    newContentState = Modifier.replaceText(
      newContentState,
      newSelectionState,
      ''
    );
    this.props.updateContentStateFromChild(newContentState);
    console.log('deleting from ' + newSelectionState.anchorOffset, newSelectionState.focusOffset);
    
    this.setState({
      render:false
    });
  }
  
  render() {
    if (this.state.render === false) return null;
    return (
      <span data-finalized="true" className={'final ' + this.state.type}>
        {this.props.children}
        <span onClick={this.deleteThis.bind(this)} className="closer">x</span>
      </span>
    );
  }
}