export interface Template {
  category: string;
  example: any;
}

export const templates: Record<string, Template> = {
  "workout-hr": {
    category: "WORKOUT",
    example: {
      category: "WORKOUT",
      type: "Ride",
      target: "HR",
      start_date_local: "2026-03-01T08:00:00",
      name: "Sweet Spot Intervals",
      description: "Warmup\n- 10m Z1 HR\n\n3x\n - 15m Z3 HR\n - 5m Z1 HR\n\nCooldown\n- 10m Z1 HR",
      moving_time: 3600,
      workout_doc: {
        steps: [
          {
            hr: { units: "hr_zone", value: 1 },
            warmup: true,
            duration: 600
          },
          {
            hr: { units: "hr_zone", value: 2 },
            duration: 600
          },
          {
            reps: 3,
            text: "3x",
            steps: [
              {
                hr: { units: "hr_zone", value: 3 },
                duration: 900
              },
              {
                hr: { units: "hr_zone", value: 1 },
                duration: 300
              }
            ]
          },
          {
            hr: { units: "hr_zone", value: 2 },
            duration: 600
          },
          {
            hr: { units: "hr_zone", value: 1 },
            cooldown: true,
            duration: 600
          }
        ],
        duration: 3600
      }
    }
  },
  "workout-power": {
    category: "WORKOUT",
    example: {
      category: "WORKOUT",
      type: "Ride",
      target: "POWER",
      start_date_local: "2026-03-01T08:00:00",
      name: "VO2 Max Intervals",
      description: "Warmup\n- 20min easy\n\n5x\n - 5min @ 300W\n - 5min recovery\n\nCooldown\n- 15min easy",
      moving_time: 5400,
      workout_doc: {
        steps: [
          {
            power: { units: "watts", value: 150 },
            warmup: true,
            duration: 1200
          },
          {
            reps: 5,
            text: "5x",
            steps: [
              {
                power: { units: "watts", value: 300 },
                duration: 300
              },
              {
                power: { units: "watts", value: 150 },
                duration: 300
              }
            ]
          },
          {
            power: { units: "watts", value: 120 },
            cooldown: true,
            duration: 900
          }
        ],
        duration: 5400
      }
    }
  },
  "note": {
    category: "NOTE",
    example: {
      category: "NOTE",
      start_date_local: "2026-03-01",
      name: "Training Note",
      description: "Notes about this day"
    }
  },
  "race": {
    category: "RACE_A",
    example: {
      category: "RACE_A",
      type: "Ride",
      start_date_local: "2026-03-01T08:00:00",
      name: "Road Race",
      description: "Important race - rest day before",
      moving_time: 7200,
      distance: 120000
    }
  }
};

export function getTemplate(name: string): Template | null {
  return templates[name] || null;
}

export function listTemplates(): string[] {
  return Object.keys(templates);
}
