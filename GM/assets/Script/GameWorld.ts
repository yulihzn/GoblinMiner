import { EventConstant } from "./EventConstant";
import Logic from "./Logic";
import TileData from "./data/TileData";
import Tile from "./Tile";
import AudioPlayer from "./utils/AudioPlayer";

// Learn TypeScript:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/typescript.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;
@ccclass
export default class GameWorld extends cc.Component {

    @property(cc.Prefab)
    playerPrefab: cc.Prefab = null;
    @property(cc.Prefab)
    tilePrefab: cc.Prefab = null;
    private timeDelay = 0;
    private checkTimeDelay = 0;
    actorLayer: cc.Node;
    map: Tile[][] = [];
    static readonly BOTTOM_LINE_INDEX = 5;
    static readonly TILE_SIZE: number = 80;
    static WIDTH_SIZE: number = 9;
    static HEIGHT_SIZE: number = 11;
    static MAPX: number = -GameWorld.WIDTH_SIZE * GameWorld.TILE_SIZE / 2;
    static MAPY: number = 128;
    canFall = false;//是否下落
    canFill = false;//是否填充
    boomList:cc.Vec3[] = [];
    speed = 0.1;
    onLoad() {
        cc.log(GameWorld.MAPX);
        cc.director.on(EventConstant.TILE_SWITCH, (event) => {
            this.tileSwitched(event.detail.tapPos, event.detail.targetPos, false);
        })
        cc.director.on(EventConstant.INIT_MAP, (event) => {
            this.initMap();
        })
        this.actorLayer = this.node.getChildByName('actorlayer');
        this.actorLayer.zIndex = 2000;
        this.initMap();
    }

    initMap() {
        this.boomList = [];
        this.actorLayer.removeAllChildren();
        this.map = new Array();
        for (let i = 0; i < GameWorld.WIDTH_SIZE; i++) {
            this.map[i] = new Array();
            for (let j = 0; j < GameWorld.HEIGHT_SIZE; j++) {
                let tile = cc.instantiate(this.tilePrefab).getComponent(Tile);
                tile.initTile(TileData.getRandomTileData(i, j));
                this.actorLayer.addChild(tile.node);
                this.map[i][j] = tile;
            }
        }
        this.checkMapValid();
        cc.log(this.showMap());
    }
    /**检查地图有效性并重组 */
    checkMapValid() {
        let boomList = this.getBoomList();
        for (let i = 0; i < boomList.length; i++) {
            let p = boomList[i];
            this.map[p.x][p.y].initTile(TileData.getRandomTileData(p.x, p.y))
        }
        if (boomList.length > 0) {
            this.checkMapValid();
        }
    }
    showMap(): string {
        let str = '';
        for (let i = 0; i < this.map[0].length; i++) {
            let tempstr = ''
            for (let j = 0; j < this.map.length; j++) {
                tempstr += this.getTileTypeString(this.map[j][i].data.tileType) + ',';
            }
            str = tempstr + '\n' + str;
        }
        return str;
    }
    getTileTypeString(type:string){
        switch(type){
            case '01':return '1';
            case '02':return '2';
            case '03':return '3';
            case '04':return '4';
            case '05':return '5';
            case '06':return '6';
            default:return '0';
        }
    }
    tileSwitched(tapPos: cc.Vec2, targetPos: cc.Vec2, isFall: boolean) {
        if (targetPos.x > this.map.length - 1 || targetPos.x < 0 || targetPos.y > this.map[0].length - 1 || targetPos.y < 0) {
            return;
        }
        if(this.canFall||this.canFill){
            return;
        }
        Logic.isProcessing = true;
        if (this.map[tapPos.x][tapPos.y].data.isEmpty || this.map[targetPos.x][targetPos.y].data.isEmpty) {
            return;
        }
        this.switchTileData(tapPos, targetPos);
        let boomList = this.getBoomList();
        this.boomList = boomList;
        if (boomList.length>0) {
            Logic.step--;
            this.map[tapPos.x][tapPos.y].node.runAction(cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(tapPos.x,tapPos.y))));
            this.map[targetPos.x][targetPos.y].node.runAction(cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(targetPos.x,targetPos.y))));
            this.boomTiles(boomList);
        } else {
            this.switchTileData(tapPos, targetPos);
            this.map[tapPos.x][tapPos.y].node.runAction(cc.sequence(cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(targetPos.x,targetPos.y)))
                , cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(tapPos.x,tapPos.y)))));
                this.map[targetPos.x][targetPos.y].node.runAction(cc.sequence(cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(tapPos.x,tapPos.y)))
                , cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(targetPos.x,targetPos.y)))));
        }
    }
   
    boomTiles(boomList:cc.Vec3[]){
        let count = 0;
        if(boomList.length>0){
            cc.director.emit(EventConstant.PLAY_AUDIO,{detail:{name:AudioPlayer.BOOM_TILE}});
        }
        for (let i = 0; i < boomList.length; i++) {
            Logic.score+=100;
            if(Logic.score>=Logic.target&&Logic.step>=0){
                cc.director.emit(EventConstant.GAME_OVER,{detail:{over:false}});
            }
            let offset = 10;
            let speed = 0.1;
            let p = boomList[i];
            this.map[p.x][p.y].node.runAction(cc.sequence(
                cc.moveBy(speed,0,offset)
                ,cc.moveBy(speed,0,-offset)
                ,cc.moveBy(speed,0,offset)
                ,cc.moveBy(speed,0,-offset)
                ,cc.moveBy(speed/2,offset,0)
                ,cc.moveBy(speed/2,-offset,0)
                ,cc.moveBy(speed/2,offset,0)
                ,cc.moveBy(speed/2,-offset,0)
            ,cc.fadeOut(this.speed)
            ,cc.callFunc(()=>{
                this.map[p.x][p.y].node.opacity = 0;
                this.map[p.x][p.y].data = TileData.getEmptyTileData(p.x,p.y);
                // if(p.z>0){
                //     this.map[p.x][p.y].data.tileSpecial = p.z;
                //     this.map[p.x][p.y].node.opacity = 255;
                //     this.map[p.x][p.y].updateTile();
                //     cc.log(p);
                // }else{
                //     this.map[p.x][p.y].node.opacity = 0;
                //     this.map[p.x][p.y].data = TileData.getEmptyTileData(p.x,p.y);
                // }
            }),cc.callFunc(()=>{
                count++;
                if(count == boomList.length){
                    this.canFall = true;
                }
            })));
        }
    }
    fallTiles(){
        this.canFall = false;
        let fallList = this.getFallList();
        if(fallList.length>0){
            cc.director.emit(EventConstant.PLAY_AUDIO,{detail:{name:AudioPlayer.FALL_TILE}});
        }
        let count = 0;
        for (let i = 0; i < fallList.length; i++) {
            let p = fallList[i];
            this.switchTileData(cc.v2(p.x, p.y), cc.v2(p.x, p.y - p.z));
            this.map[p.x][p.y - p.z].node.runAction(cc.sequence(cc.delayTime(this.speed),cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(p.x, p.y - p.z))).easing(cc.easeBackIn()),cc.callFunc(()=>{
                count++;
                if(count == fallList.length){
                    this.canFill = true;
                }
            })));
        }
        if(fallList.length<1){
            this.canFill = true;
        }
    }
    fillTiles(){
        this.canFill = false;
        let emptyList = this.getEmptyList();
        let count = 0;
        for (let i = 0; i < emptyList.length; i++) {
            let p = emptyList[i];
            this.map[p.x][p.y].node.runAction(cc.sequence(cc.moveTo(this.speed, GameWorld.getPosInMap(cc.v2(p.x, GameWorld.HEIGHT_SIZE+p.y))),cc.fadeIn(this.speed), cc.moveTo(this.speed*2, GameWorld.getPosInMap(cc.v2(p.x, p.y))).easing(cc.easeBackIn()),cc.callFunc(()=>{
                count++;
                if(count == emptyList.length){
                    let boomList = this.getBoomList();
                    this.boomList = boomList;
                    this.boomTiles(boomList);
                    if(boomList.length<1&&Logic.step<1){
                        cc.director.emit(EventConstant.GAME_OVER,{detail:{over:true}});
                    }
                }
            })));
            this.map[p.x][p.y].initTile(TileData.getRandomTileData(p.x, p.y));
        }
    }

    /** 交换数据位置 */
    switchTileData(tapPos: cc.Vec2, targetPos: cc.Vec2) {
        let tile1 = this.map[tapPos.x][tapPos.y];
        let tile2 = this.map[targetPos.x][targetPos.y];
        let pos = tile1.data.posIndex;
        tile1.data.posIndex = tile2.data.posIndex.clone();
        tile2.data.posIndex = pos.clone();
        this.map[tapPos.x][tapPos.y] = tile2;
        this.map[targetPos.x][targetPos.y] = tile1;
    }
    /**获取可消除方块坐标列表 */
    getBoomList(): cc.Vec3[] {
        let boomMap: { [key: string]: cc.Vec3 } = {};
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[0].length; j++) {
                let boomList1: cc.Vec3[] = new Array();
                boomList1 = this.findBoomTile(boomList1, i, j, 0);
                boomList1 = this.findBoomTile(boomList1, i, j, 1);
                let boomList2: cc.Vec3[] = new Array();
                boomList2 = this.findBoomTile(boomList2, i, j, 2);
                boomList2 = this.findBoomTile(boomList2, i, j, 3);
                if (boomList1.length > 1) {
                    for (let p of boomList1) {
                        boomMap = this.setBoomMapData(boomMap,p);
                    }
                    boomMap = this.setBoomMapData(boomMap,cc.v3(i,j,0));
                }
                if (boomList2.length > 1) {
                    for (let p of boomList2) {
                        boomMap = this.setBoomMapData(boomMap,p);
                    }
                    boomMap = this.setBoomMapData(boomMap,cc.v3(i,j,0));
                }
                // //设置横竖特殊
                // if(boomList1.length>2){
                //     boomMap = this.setBoomMapData(boomMap,cc.v3(i,j,2));
                //     cc.log('four2')
                // }
                // if(boomList2.length>2){
                //     boomMap = this.setBoomMapData(boomMap,cc.v3(i,j,1));
                //     cc.log('four1')
                // }
                // //设置交叉特殊
                // if(boomList1.length>1&&boomList2.length>1){
                //     boomMap = this.setBoomMapData(boomMap,cc.v3(i,j,3));
                //     cc.log('cross')
                // }
                // //设置五连
                // if(boomList1.length>3||boomList2.length>3){
                //     boomMap = this.setBoomMapData(boomMap,cc.v3(i,j,4));
                //     cc.log('five')
                // }
            }
        }
        let boomList:cc.Vec3[] = new Array();
        for (let k in boomMap) {
            let pos = boomMap[k];
            boomList.push(pos);
        }
        return boomList;
    }
    setBoomMapData(boomMap: { [key: string]: cc.Vec3 },p:cc.Vec3): { [key: string]: cc.Vec3 }{
        if(boomMap[`x=${p.x}y=${p.y}`]){
            if(boomMap[`x=${p.x}y=${p.y}`].z<=p.z){
                boomMap[`x=${p.x}y=${p.x}`] = p.clone();
            }
        }else{
            boomMap[`x=${p.x}y=${p.y}`] = p.clone();
        }
        return boomMap;
    }
    /**获取可下落方块坐标列表 其中z代表下落格数 */
    getFallList(): cc.Vec3[] {
        let fallList:cc.Vec3[] = new Array();
        for (let i = 0; i < this.map.length; i++) {
            let count = 0;
            let isSave = false;
            for (let j = 0; j < this.map[0].length; j++) {
                //由下往上查找是否有空方块，如果有计数+1，继续遍历到空方块继续+1，不是空方块且计数不为0，保存该点，继续寻找下一个
                if (this.map[i][j].data.isEmpty) {
                    if(isSave){
                        isSave = false;
                        count = 0;
                    }
                    count++;
                }else{
                    if(count>0){
                        isSave = true;
                        fallList.push(cc.v3(i, j, count));
                    }
                }
            }
        }
        return fallList;
    }
    /**获取空的下标列表 */
    getEmptyList() {
        let emptyList = new Array();
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[0].length; j++) {
                if (this.map[i][j].data.isEmpty) {
                    emptyList.push(cc.v2(i, j));
                }
            }
        }
        return emptyList;
    }
    /**查找指定方向的相同方块 */
    findBoomTile(boomList: cc.Vec3[], x: number, y: number, dir: number): cc.Vec3[] {
        let i = x;
        let j = y;
        switch (dir) {
            case 0: j = y + 1; break;
            case 1: j = y - 1; break;
            case 2: i = x - 1; break;
            case 3: i = x + 1; break;
        }
        if (this.isTypeEqual(cc.v2(x, y), cc.v2(i, j))) {
            boomList.push(cc.v3(i, j,0));
            return this.findBoomTile(boomList, i, j, dir);
        } else {
            return boomList;
        }
    }
    /**方块是否相同，空白方块忽略 */
    isTypeEqual(pos1: cc.Vec2, pos2: cc.Vec2): boolean {
        if (pos1.x > this.map.length - 1 || pos1.x < 0 || pos1.y > this.map[0].length - 1 || pos1.y < 0) {
            return false;
        }
        if (pos2.x > this.map.length - 1 || pos2.x < 0 || pos2.y > this.map[0].length - 1 || pos2.y < 0) {
            return false;
        }
        if (this.map[pos1.x][pos1.y].data.tileType == '00' || this.map[pos2.x][pos2.y].data.tileType == '00') {
            return false;
        }
        return this.map[pos1.x][pos1.y].data.tileType == this.map[pos2.x][pos2.y].data.tileType;
    }

    isTimeDelay(dt: number): boolean {
        this.timeDelay += dt;
        if (this.timeDelay > 0.016) {
            this.timeDelay = 0;
            return true;
        }
        return false;
    }
    isCheckTimeDelay(dt: number): boolean {
        this.checkTimeDelay += dt;
        if (this.checkTimeDelay > 1) {
            this.checkTimeDelay = 0;
            return true;
        }
        return false;
    }

    update(dt) {
        if(this.isTimeDelay(dt)){
            if(this.canFall){
                this.fallTiles();
            }
            if(this.canFill){
                this.fillTiles();
            }
            Logic.isProcessing = this.boomList.length>0;
        }
    }

    //获取地图里下标的坐标
    static getPosInMap(pos: cc.Vec2) {
        let x = GameWorld.MAPX + pos.x * GameWorld.TILE_SIZE + GameWorld.TILE_SIZE / 2;
        let y = GameWorld.MAPY + pos.y * GameWorld.TILE_SIZE;
        return cc.v2(x, y);
    }
    //获取坐标在地图里的下标,canOuter:是否可以超出
    static getIndexInMap(pos: cc.Vec2, canOuter?: boolean) {
        let x = (pos.x - GameWorld.MAPX) / GameWorld.TILE_SIZE;
        let y = (pos.y - GameWorld.MAPY) / GameWorld.TILE_SIZE;
        x = Math.round(x);
        y = Math.round(y);
        if (!canOuter) {
            if (x < 0) { x = 0 }; if (x >= GameWorld.WIDTH_SIZE) { x = GameWorld.WIDTH_SIZE - 1 };
            if (y < 0) { y = 0 }; if (y >= GameWorld.HEIGHT_SIZE) { y = GameWorld.HEIGHT_SIZE - 1 };
        }
        return cc.v2(x, y);
    }
    //获取不超出地图的坐标
    static fixOuterMap(pos: cc.Vec2): cc.Vec2 {
        let x = (pos.x - GameWorld.MAPX) / GameWorld.TILE_SIZE;
        let y = (pos.y - GameWorld.MAPY) / GameWorld.TILE_SIZE;
        x = Math.round(x);
        y = Math.round(y);
        let isOuter = false;
        if (x < 0) { x = 0; isOuter = true; }
        if (x >= GameWorld.WIDTH_SIZE) { x = GameWorld.WIDTH_SIZE - 1; isOuter = true; }
        if (y < 0) { y = 0; isOuter = true; }
        if (y >= GameWorld.HEIGHT_SIZE) { y = GameWorld.HEIGHT_SIZE - 1; isOuter = true; }
        if (isOuter) {
            return GameWorld.getPosInMap(cc.v2(x, y));
        } else {
            return pos;
        }
    }
}
