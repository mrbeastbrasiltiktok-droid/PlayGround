import type { FlightProfile } from '../FlightSystem';

export const ironManFlightProfile: FlightProfile = {
  id: 'ironman',
  label: 'Voo com Propulsores do Homem de Ferro',
  altitude: 3.6,
  maxSpeed: 8.8,
  hoverAmplitude: 0.12,
  hoverFrequency: 0.0035,
  bankStrength: 0.55,
  bankLimit: 0.42,
  sound: 'thruster',
  thrusterVisuals: true,
};
