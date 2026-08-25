import type { Tone } from './interpret';

export const ritualMedia={
  intro:'/ritual-media/00-qimen-intro.mp4',
  doors:{
    开门:'/ritual-media/door-kai.mp4',休门:'/ritual-media/door-xiu.mp4',生门:'/ritual-media/door-sheng.mp4',
    伤门:'/ritual-media/door-shang.mp4',杜门:'/ritual-media/door-du.mp4',景门:'/ritual-media/door-jing.mp4',
    死门:'/ritual-media/door-si.mp4',惊门:'/ritual-media/door-jing-alarm.mp4',
  } as Record<string,string>,
  overlays:{bright:'/ritual-media/overlay-auspicious.mp4',neutral:'/ritual-media/overlay-neutral.mp4',caution:'/ritual-media/overlay-caution.mp4'} as Record<Tone,string>,
};

export function mediaForReading(door:string,tone:Tone){
  return {intro:ritualMedia.intro,reveal:ritualMedia.doors[door],overlay:ritualMedia.overlays[tone]};
}
