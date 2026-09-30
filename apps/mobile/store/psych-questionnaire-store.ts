import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PsychQuestionnaireState = {
  assessmentId: string | null;
  responses: Record<string, string>;
  begin: (assessmentId: string) => void;
  setResponse: (itemCode: string, rawValue: string) => void;
  clear: () => void;
};

export const usePsychQuestionnaireStore = create<PsychQuestionnaireState>()(
  persist(
    (set, get) => ({
      assessmentId: null,
      responses: {},
      begin: (assessmentId) => {
        if (get().assessmentId !== assessmentId) {
          set({ assessmentId, responses: {} });
        }
      },
      setResponse: (itemCode, rawValue) => set((state) => ({
        responses: { ...state.responses, [itemCode]: rawValue },
      })),
      clear: () => set({ assessmentId: null, responses: {} }),
    }),
    {
      name: 'psych-questionnaire-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
