import { Machine, assign, sendParent } from 'xstate'

import backgroundIsDark from './backgroundIsDark'
import backgroundIsLight from './backgroundIsLight'

function createMainRenderingMachine(options, context) {
  return Machine(
    {
      id: 'main',
      initial: 'idle',
      context,
      states: {
        idle: {
          always: {
            target: 'active',
            actions: ['setBackgroundColor'],
          },
        },
        active: {
          type: 'parallel',
          on: {
            SET_BACKGROUND_COLOR: {
              actions: ['setBackgroundColor'],
            },
          },
          states: {
            background: {
              initial: 'light',
              states: {
                dark: {
                  entry: assign({ uiDarkMode: context => true }),
                  on: {
                    SET_BACKGROUND_COLOR: {
                      target: ['light'],
                      cond: backgroundIsLight,
                      actions: sendParent('BACKGROUND_TURNED_LIGHT'),
                    },
                  },
                },
                light: {
                  entry: assign({ uiDarkMode: context => false }),
                  on: {
                    SET_BACKGROUND_COLOR: {
                      target: ['dark'],
                      cond: backgroundIsDark,
                      actions: sendParent('BACKGROUND_TURNED_DARK'),
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    options
  )
}

export default createMainRenderingMachine
