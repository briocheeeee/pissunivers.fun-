const initialState = {
  myFaction: null,
  currentFaction: null,
  rankings: [],
  rankingsTotal: 0,
  rankingsPage: 1,
  loading: false,
  error: null,
};

export default function faction(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 's/REC_ME':
    case 's/LOGIN': {
      return {
        ...state,
        myFaction: action.faction || null,
      };
    }

    case 's/LOGOUT': {
      return {
        ...state,
        myFaction: null,
      };
    }

    case 'FACTION_LOADING': {
      return {
        ...state,
        loading: true,
        error: null,
      };
    }

    case 'FACTION_ERROR': {
      return {
        ...state,
        loading: false,
        error: action.error,
      };
    }

    case 'REC_MY_FACTION': {
      return {
        ...state,
        myFaction: action.faction,
        loading: false,
        error: null,
      };
    }

    case 'REC_FACTION': {
      return {
        ...state,
        currentFaction: action.faction,
        loading: false,
        error: null,
      };
    }

    case 'REC_FACTION_RANKINGS': {
      return {
        ...state,
        rankings: action.rankings,
        rankingsTotal: action.total,
        rankingsPage: action.page,
        loading: false,
        error: null,
      };
    }

    case 'CLEAR_MY_FACTION': {
      return {
        ...state,
        myFaction: null,
      };
    }

    case 'CLEAR_CURRENT_FACTION': {
      return {
        ...state,
        currentFaction: null,
      };
    }

    case 'UPDATE_MY_FACTION': {
      if (!state.myFaction) return state;
      return {
        ...state,
        myFaction: {
          ...state.myFaction,
          ...action.updates,
        },
      };
    }

    default:
      return state;
  }
}
