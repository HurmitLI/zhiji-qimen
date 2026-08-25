export const ritualMedia={
  poster:'/ritual-media/qimen-poster.jpg',
  intro:'/ritual-media/qimen-intro.mp4',
  ritual:'/ritual-media/qimen-ritual.mp4',
  doors:{
    开门:'/ritual-media/door-kai.mp4',休门:'/ritual-media/door-xiu.mp4',生门:'/ritual-media/door-sheng.mp4',
    伤门:'/ritual-media/door-shang.mp4',杜门:'/ritual-media/door-du.mp4',景门:'/ritual-media/door-jing.mp4',
    死门:'/ritual-media/door-si.mp4',惊门:'/ritual-media/door-jing-alarm.mp4',
  } as Record<string,string>,
};

export function mediaForStage(stage:number,door:string){
  if(stage===11)return ritualMedia.doors[door]||ritualMedia.ritual;
  if(stage>=6)return ritualMedia.ritual;
  return ritualMedia.intro;
}
