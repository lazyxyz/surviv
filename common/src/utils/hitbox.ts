import { type Orientation } from "../typings";
import { Collision, Geometry, Numeric, type CollisionRecord, type IntersectionResponse } from "./math";
import { cloneDeepSymbol, cloneSymbol, type Cloneable, type DeepCloneable } from "./misc";
import { pickRandomInArray, randomFloat, randomPointInsideCircle } from "./random";
import { Vec, type Vector } from "./vector";
export enum HitboxType {
    Circle,
    Rect,
    Group,
    Polygon
}
export interface HitboxJSONMapping {
    [HitboxType.Circle]: {
        readonly type: HitboxType.Circle
        readonly radius: number
        readonly position: Vector
    }
    [HitboxType.Rect]: {
        readonly type: HitboxType.Rect
        readonly min: Vector
        readonly max: Vector
    }
    [HitboxType.Group]: {
        readonly type: HitboxType.Group
        readonly hitboxes: Array<HitboxJSONMapping[HitboxType.Circle | HitboxType.Rect | HitboxType.Polygon]>
    }
    [HitboxType.Polygon]: {
        readonly type: HitboxType.Polygon
        readonly points: Vector[]
        readonly center: Vector
    }
}
export type HitboxJSON = HitboxJSONMapping[HitboxType];
export interface HitboxMapping {
    [HitboxType.Circle]: CircleHitbox
    [HitboxType.Rect]: RectangleHitbox
    [HitboxType.Group]: GroupHitbox
    [HitboxType.Polygon]: PolygonHitbox
}
export type Hitbox = HitboxMapping[HitboxType];
export abstract class BaseHitbox<T extends HitboxType = HitboxType> implements DeepCloneable<HitboxMapping[T]>, Cloneable<HitboxMapping[T]> {
    abstract type: HitboxType;
    abstract toJSON(): HitboxJSONMapping[T];
    static fromJSON<T extends HitboxType>(data: HitboxJSONMapping[T]): HitboxMapping[T];
    static fromJSON(data: HitboxJSON): Hitbox {
        switch (data.type) {
            case HitboxType.Circle:
                return new CircleHitbox(data.radius, data.position);
            case HitboxType.Rect:
                return new RectangleHitbox(data.min, data.max);
            case HitboxType.Group:
                return new GroupHitbox(
                    ...data.hitboxes.map(d => BaseHitbox.fromJSON<HitboxType.Circle | HitboxType.Rect | HitboxType.Polygon>(d))
                );
            case HitboxType.Polygon:
                return new PolygonHitbox(data.points);
        }
    }
    abstract collidesWith(that: Hitbox): boolean;
    abstract resolveCollision(that: Hitbox): void; // Kept as is for compatibility
    abstract getAdjustment(that: Hitbox, factor: number): Vector; // NEW: With factor to scale the push (1=full resolve, 0.5=half, etc.)
    abstract distanceTo(that: Hitbox): CollisionRecord;
    abstract clone(deep?: boolean): HitboxMapping[T];
    [cloneSymbol](): HitboxMapping[T] { return this.clone(false); }
    [cloneDeepSymbol](): HitboxMapping[T] { return this.clone(true); }
    abstract transform(position: Vector, scale?: number, orientation?: Orientation): Hitbox;
    abstract transformRotate(position: Vector, scale?: number, rotation?: number): Hitbox;
    abstract scale(scale: number): void;
    abstract intersectsLine(a: Vector, b: Vector): IntersectionResponse;
    abstract randomPoint(): Vector;
    abstract toRectangle(): RectangleHitbox;
    abstract isPointInside(point: Vector): boolean;
    abstract getCenter(): Vector;
    protected throwUnknownSubclassError(that: Hitbox): never {
        throw new Error(`Hitbox type ${HitboxType[this.type]} doesn't support this operation with hitbox type ${HitboxType[that.type]}`);
    }
    protected getIntersection(that: Hitbox): { dir: Vector; pen: number } | null {
        this.throwUnknownSubclassError(that);
    }
    protected applyAdjust(adjust: Vector): void {
        // this.throwUnknownSubclassError(this); // Not used, but for completeness
    }
}
export class CircleHitbox extends BaseHitbox<HitboxType.Circle> {
    override readonly type = HitboxType.Circle;
    position: Vector;
    radius: number;
    static simple(radius: number, center?: Vector): HitboxJSONMapping[HitboxType.Circle] {
        return {
            type: HitboxType.Circle,
            radius,
            position: center ?? Vec.create(0, 0)
        };
    }
    constructor(radius: number, position?: Vector) {
        super();
        this.position = position ?? Vec.create(0, 0);
        this.radius = radius;
    }
    override toJSON(): HitboxJSONMapping[HitboxType.Circle] {
        return {
            type: this.type,
            radius: this.radius,
            position: Vec.clone(this.position)
        };
    }
    override collidesWith(that: Hitbox): boolean {
        switch (that.type) {
            case HitboxType.Circle:
                return Collision.circleCollision(that.position, that.radius, this.position, this.radius);
            case HitboxType.Rect:
                return Collision.rectangleCollision(that.min, that.max, this.position, this.radius);
            case HitboxType.Group:
                return that.collidesWith(this);
            case HitboxType.Polygon:
                // TODO: proper circle to polygon detection
                return that.collidesWith(this.toRectangle());
        }
    }
    override resolveCollision(that: Hitbox): void {
        switch (that.type) {
            case HitboxType.Circle: {
                const collision = Collision.circleCircleIntersection(this.position, this.radius, that.position, that.radius);
                if (collision) {
                    this.position = Vec.sub(this.position, Vec.scale(collision.dir, collision.pen));
                }
                break;
            }
            case HitboxType.Rect: {
                const collision = Collision.rectCircleIntersection(that.min, that.max, this.position, this.radius);
                if (collision) {
                    this.position = Vec.sub(this.position, Vec.scale(collision.dir, collision.pen));
                }
                break;
            }
            case HitboxType.Group: {
                for (const hitbox of that.hitboxes) {
                    if (this.collidesWith(hitbox)) {
                        this.resolveCollision(hitbox);
                    }
                }
                break;
            }
            case HitboxType.Polygon: {
                const rect = that.toRectangle();
                const collision = Collision.rectCircleIntersection(rect.min, rect.max, this.position, this.radius);
                if (collision) {
                    this.position = Vec.sub(this.position, Vec.scale(collision.dir, collision.pen));
                }
                break;
            }
        }
    }
    override getAdjustment(that: Hitbox, factor: number = 1): Vector {
        const collision = this.getIntersection(that);
        if (collision) {
            return Vec.scale(collision.dir, collision.pen * factor);
        }
        return Vec.create(0, 0);
    }
    protected override getIntersection(that: Hitbox): { dir: Vector; pen: number } | null {
        switch (that.type) {
            case HitboxType.Circle:
                return Collision.circleCircleIntersection(this.position, this.radius, that.position, that.radius);
            case HitboxType.Rect:
                return Collision.rectCircleIntersection(that.min, that.max, this.position, this.radius);
            case HitboxType.Group:
                let maxPen = 0;
                let selected: { dir: Vector; pen: number } | null = null;
                for (const h of that.hitboxes) {
                    const coll = this.getIntersection(h);
                    if (coll && coll.pen > maxPen) {
                        maxPen = coll.pen;
                        selected = coll;
                    }
                }
                return selected;
            case HitboxType.Polygon:
                // Approximate
                const rect = that.toRectangle();
                return Collision.rectCircleIntersection(rect.min, rect.max, this.position, this.radius);
        }
    }
    override distanceTo(that: Hitbox): CollisionRecord {
        switch (that.type) {
            case HitboxType.Circle:
                return Collision.distanceBetweenCircles(that.position, that.radius, this.position, this.radius);
            case HitboxType.Rect:
                return Collision.distanceBetweenRectangleCircle(that.min, that.max, this.position, this.radius);
            case HitboxType.Group:
                let minDist = Number.MAX_VALUE;
                let record: CollisionRecord;
                for (const hitbox of that.hitboxes) {
                    const newRecord = this.distanceTo(hitbox);
                    if (newRecord.distance < minDist) {
                        minDist = newRecord.distance;
                        record = newRecord;
                    }
                }
                return record!;
            case HitboxType.Polygon:
                const rect = that.toRectangle();
                return Collision.distanceBetweenRectangleCircle(rect.min, rect.max, this.position, this.radius);
        }
    }
    override clone(deep = true): CircleHitbox {
        return new CircleHitbox(this.radius, deep ? Vec.clone(this.position) : this.position);
    }
    override transform(position: Vector, scale = 1, orientation = 0 as Orientation): CircleHitbox {
        return new CircleHitbox(this.radius * scale, Vec.addAdjust(position, this.position, orientation));
    }
    override transformRotate(position: Vector, scale = 1, rotation = 0): CircleHitbox {
        return new CircleHitbox(this.radius * scale, Vec.add(Vec.rotate(this.position, rotation), position));
    }
    override scale(scale: number): void {
        this.radius *= scale;
    }
    override intersectsLine(a: Vector, b: Vector): IntersectionResponse {
        return Collision.lineIntersectsCircle(a, b, this.position, this.radius);
    }
    override randomPoint(): Vector {
        return randomPointInsideCircle(this.position, this.radius);
    }
    override toRectangle(): RectangleHitbox {
        return new RectangleHitbox(Vec.create(this.position.x - this.radius, this.position.y - this.radius), Vec.create(this.position.x + this.radius, this.position.y + this.radius));
    }
    override isPointInside(point: Vector): boolean {
        return Geometry.distance(point, this.position) < this.radius;
    }
    override getCenter(): Vector {
        return this.position;
    }
}

export class RectangleHitbox extends BaseHitbox<HitboxType.Rect> {
    override readonly type = HitboxType.Rect;
    min: Vector;
    max: Vector;
    get width(): number {
        return this.max.x - this.min.x;
    }
    get height(): number {
        return this.max.y - this.min.y;
    }
    static fromLine(a: Vector, b: Vector): RectangleHitbox {
        return new RectangleHitbox(
            Vec.create(
                Numeric.min(a.x, b.x),
                Numeric.min(a.y, b.y)
            ),
            Vec.create(
                Numeric.max(a.x, b.x),
                Numeric.max(a.y, b.y)
            )
        );
    }
    static fromRect(width: number, height: number, center = Vec.create(0, 0)): RectangleHitbox {
        const size = Vec.create(width / 2, height / 2);
        return new RectangleHitbox(
            Vec.sub(center, size),
            Vec.add(center, size)
        );
    }
    static simple(width: number, height: number, center = Vec.create(0, 0)): HitboxJSONMapping[HitboxType.Rect] {
        const size = Vec.create(width / 2, height / 2);
        return {
            type: HitboxType.Rect,
            min: Vec.sub(center, size),
            max: Vec.add(center, size)
        };
    }
    constructor(min: Vector, max: Vector) {
        super();
        this.min = min;
        this.max = max;
    }
    override toJSON(): HitboxJSONMapping[HitboxType.Rect] {
        return {
            type: this.type,
            min: Vec.clone(this.min),
            max: Vec.clone(this.max)
        };
    }
    override collidesWith(that: Hitbox): boolean {
        switch (that.type) {
            case HitboxType.Circle:
                return Collision.rectangleCollision(this.min, this.max, that.position, that.radius);
            case HitboxType.Rect:
                return Collision.rectRectCollision(that.min, that.max, this.min, this.max);
            case HitboxType.Group:
            case HitboxType.Polygon:
                return that.collidesWith(this);
        }
    }
    override resolveCollision(that: Hitbox): void {
        switch (that.type) {
            case HitboxType.Circle: {
                const collision = Collision.rectCircleIntersection(this.min, this.max, that.position, that.radius);
                if (collision) {
                    const rect = this.transform(Vec.scale(collision.dir, -collision.pen));
                    this.min = rect.min;
                    this.max = rect.max;
                }
                break;
            }
            case HitboxType.Rect: {
                const collision = Collision.rectRectIntersection(this.min, this.max, that.min, that.max);
                if (collision) {
                    const rect = this.transform(Vec.scale(collision.dir, -collision.pen));
                    this.min = rect.min;
                    this.max = rect.max;
                }
                break;
            }
            case HitboxType.Group: {
                for (const hitbox of that.hitboxes) {
                    if (this.collidesWith(hitbox)) this.resolveCollision(hitbox);
                }
                break;
            }
            case HitboxType.Polygon: {
                const rect = that.toRectangle();
                const collision = Collision.rectRectIntersection(this.min, this.max, rect.min, rect.max);
                if (collision) {
                    const newRect = this.transform(Vec.scale(collision.dir, -collision.pen));
                    this.min = newRect.min;
                    this.max = newRect.max;
                }
                break;
            }
        }
    }
    override getAdjustment(that: Hitbox, factor: number = 1): Vector {
        const collision = this.getIntersection(that);
        if (collision) {
            return Vec.scale(collision.dir, collision.pen * factor);
        }
        return Vec.create(0, 0);
    }
    override getIntersection(that: Hitbox): { dir: Vector; pen: number } | null {
        switch (that.type) {
            case HitboxType.Circle:
                return Collision.rectCircleIntersection(this.min, this.max, that.position, that.radius);
            case HitboxType.Rect:
                return Collision.rectRectIntersection(this.min, this.max, that.min, that.max);
            case HitboxType.Group:
                let maxPen = 0;
                let selected: { dir: Vector; pen: number } | null = null;
                for (const h of that.hitboxes) {
                    const coll = this.getIntersection(h);
                    if (coll && coll.pen > maxPen) {
                        maxPen = coll.pen;
                        selected = coll;
                    }
                }
                return selected;
            case HitboxType.Polygon:
                // Approximate
                const rect = that.toRectangle();
                return Collision.rectRectIntersection(this.min, this.max, rect.min, rect.max);
        }
    }
    override distanceTo(that: Hitbox): CollisionRecord {
        switch (that.type) {
            case HitboxType.Circle:
                return Collision.distanceBetweenRectangleCircle(this.min, this.max, that.position, that.radius);
            case HitboxType.Rect:
                return Collision.distanceBetweenRectangles(that.min, that.max, this.min, this.max);
            case HitboxType.Group:
                let minDist = Number.MAX_VALUE;
                let record: CollisionRecord;
                for (const hitbox of that.hitboxes) {
                    const newRecord = this.distanceTo(hitbox);
                    if (newRecord.distance < minDist) {
                        minDist = newRecord.distance;
                        record = newRecord;
                    }
                }
                return record!;
            case HitboxType.Polygon:
                const rect = that.toRectangle();
                return Collision.distanceBetweenRectangles(this.min, this.max, rect.min, rect.max);
        }
    }
    override clone(deep = true): RectangleHitbox {
        return new RectangleHitbox(
            deep ? Vec.clone(this.min) : this.min,
            deep ? Vec.clone(this.max) : this.max
        );
    }
    override transform(position: Vector, scale = 1, orientation = 0 as Orientation): RectangleHitbox {
        const rect = Geometry.transformRectangle(position, this.min, this.max, scale, orientation);
        return new RectangleHitbox(rect.min, rect.max);
    }

    override transformRotate(position: Vector, scale = 1, rotation = 0): PolygonHitbox {
        const corners = [
            Vec.create(this.min.x, this.min.y),
            Vec.create(this.max.x, this.min.y),
            Vec.create(this.max.x, this.max.y),
            Vec.create(this.min.x, this.max.y)
        ];
        const scaledCorners = corners.map(corner => Vec.scale(corner, scale));
        const rotatedCorners = scaledCorners.map(corner => Vec.rotate(corner, rotation));
        const translatedCorners = rotatedCorners.map(corner => Vec.add(corner, position));
        const center = this.getCenter();
        const scaledCenter = Vec.scale(center, scale);
        const rotatedCenter = Vec.rotate(scaledCenter, rotation);
        const translatedCenter = Vec.add(rotatedCenter, position);
        return new PolygonHitbox(translatedCorners, translatedCenter);
    }

    override scale(scale: number): void {
        const centerX = (this.min.x + this.max.x) / 2;
        const centerY = (this.min.y + this.max.y) / 2;
        this.min = Vec.create((this.min.x - centerX) * scale + centerX, (this.min.y - centerY) * scale + centerY);
        this.max = Vec.create((this.max.x - centerX) * scale + centerX, (this.max.y - centerY) * scale + centerY);
    }
    override intersectsLine(a: Vector, b: Vector): IntersectionResponse {
        return Collision.lineIntersectsRect(a, b, this.min, this.max);
    }
    override randomPoint(): Vector {
        return {
            x: randomFloat(this.min.x, this.max.x),
            y: randomFloat(this.min.y, this.max.y)
        };
    }
    override toRectangle(): RectangleHitbox {
        return this.clone();
    }
    override isPointInside(point: Vector): boolean {
        return point.x > this.min.x && point.y > this.min.y && point.x < this.max.x && point.y < this.max.y;
    }
    override getCenter(): Vector {
        return {
            x: this.min.x + ((this.max.x - this.min.x) / 2),
            y: this.min.y + ((this.max.y - this.min.y) / 2)
        };
    }
    isFullyWithin(that: RectangleHitbox): boolean {
        return (
            that.min.x <= this.min.x
            && that.min.y <= this.min.y
            && that.max.x >= this.max.x
            && that.max.y >= this.max.y
        );
    }
}
export class GroupHitbox<GroupType extends Array<RectangleHitbox | CircleHitbox | PolygonHitbox> = Array<RectangleHitbox | CircleHitbox | PolygonHitbox>> extends BaseHitbox<HitboxType.Group> {
    override readonly type = HitboxType.Group;
    position = Vec.create(0, 0);
    hitboxes: GroupType;
    static simple<ChildType extends ReadonlyArray<RectangleHitbox | CircleHitbox | PolygonHitbox> = ReadonlyArray<RectangleHitbox | CircleHitbox | PolygonHitbox>>(...hitboxes: ChildType): HitboxJSONMapping[HitboxType.Group] {
        return {
            type: HitboxType.Group,
            hitboxes: hitboxes.map(h => h.toJSON())
        };
    }
    constructor(...hitboxes: GroupType) {
        super();
        this.hitboxes = hitboxes;
    }
    override toJSON(): HitboxJSONMapping[HitboxType.Group] {
        return {
            type: HitboxType.Group,
            hitboxes: this.hitboxes.map(hitbox => hitbox.toJSON())
        };
    }
    override collidesWith(that: Hitbox): boolean {
        return this.hitboxes.some(hitbox => hitbox.collidesWith(that));
    }
    override resolveCollision(that: Hitbox): void {
        that.resolveCollision(this);
    }
    override getAdjustment(that: Hitbox, factor: number = 1): Vector {
        let totalAdjust = Vec.create(0, 0);
        let count = 0;
        for (const h of this.hitboxes) {
            const adjust = h.getAdjustment(that, factor);
            if (adjust.x !== 0 || adjust.y !== 0) {
                totalAdjust = Vec.add(totalAdjust, adjust);
                count++;
            }
        }
        if (count > 0) {
            return Vec.scale(totalAdjust, 1 / count); // Average for smooth resolution
        }
        return Vec.create(0, 0);
    }
    override distanceTo(that: Hitbox): CollisionRecord {
        let minDist = Number.MAX_VALUE;
        let record: CollisionRecord;
        for (const hitbox of this.hitboxes) {
            const newRecord = hitbox.distanceTo(that);
            if (newRecord.distance < minDist) {
                minDist = newRecord.distance;
                record = newRecord;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return record!;
    }
    override clone(deep = true): GroupHitbox {
        return new GroupHitbox(
            ...(
                deep
                    ? this.hitboxes.map(hitbox => hitbox.clone(true))
                    : this.hitboxes
            )
        );
    }
    override transform(position: Vector, scale?: number, orientation?: Orientation): GroupHitbox {
        this.position = position;
        return new GroupHitbox(
            ...this.hitboxes.map(hitbox => hitbox.transform(position, scale, orientation))
        );
    }
    override transformRotate(position: Vector, scale = 1, rotation = 0): GroupHitbox {
        this.position = position;
        return new GroupHitbox(
            ...this.hitboxes.map(hitbox => hitbox.transformRotate(position, scale, rotation))
        );
    }
    override scale(scale: number): void {
        for (const hitbox of this.hitboxes) hitbox.scale(scale);
    }
    override intersectsLine(a: Vector, b: Vector): IntersectionResponse {
        const intersections: Array<{ readonly point: Vector, readonly normal: Vector }> = [];
        for (const hitbox of this.hitboxes) {
            const intersection = hitbox.intersectsLine(a, b);
            if (intersection) intersections.push(intersection);
        }
        return intersections.sort((c, d) => Geometry.distanceSquared(c.point, a) - Geometry.distanceSquared(d.point, a))[0] ?? null;
    }
    override randomPoint(): Vector {
        return pickRandomInArray(this.hitboxes).randomPoint();
    }
    override toRectangle(): RectangleHitbox {
        const min = Vec.create(Number.MAX_VALUE, Number.MAX_VALUE);
        const max = Vec.create(0, 0);
        for (const hitbox of this.hitboxes) {
            const toRect = hitbox.toRectangle();
            min.x = Numeric.min(min.x, toRect.min.x);
            min.y = Numeric.min(min.y, toRect.min.y);
            max.x = Numeric.max(max.x, toRect.max.x);
            max.y = Numeric.max(max.y, toRect.max.y);
        }
        return new RectangleHitbox(min, max);
    }
    override isPointInside(point: Vector): boolean {
        for (const hitbox of this.hitboxes) {
            if (hitbox.isPointInside(point)) return true;
        }
        return false;
    }
    override getCenter(): Vector {
        return this.toRectangle().getCenter();
    }
}
export class PolygonHitbox extends BaseHitbox<HitboxType.Polygon> {
    override readonly type = HitboxType.Polygon;
    points: Vector[];
    center: Vector;
    static simple(points: Vector[], center = Vec.create(0, 0)): HitboxJSONMapping[HitboxType.Polygon] {
        return {
            type: HitboxType.Polygon,
            points,
            center
        };
    }
    constructor(points: Vector[], center = Vec.create(0, 0)) {
        super();
        this.points = points;
        this.center = center;
    }
    override toJSON(): HitboxJSONMapping[HitboxType.Polygon] {
        return {
            type: this.type,
            points: this.points.map(point => Vec.clone(point)),
            center: this.center
        };
    }
    override collidesWith(that: Hitbox): boolean {
        switch (that.type) {
            case HitboxType.Rect: {
                if (this.isPointInside(that.min) || this.isPointInside(that.max)) return true;
                const length = this.points.length;
                for (let i = 0; i < length; i++) {
                    const a = this.points[i];
                    if (that.isPointInside(a)) return true;
                    const b = this.points[(i + 1) % length];
                    if (Collision.lineIntersectsRectTest(b, a, that.min, that.max)) {
                        return true;
                    }
                }
                return false;
            }
            case HitboxType.Group:
            case HitboxType.Circle: {
                return that.collidesWith(this);
            }
            case HitboxType.Polygon: {
                // Approximate with rectangles for now
                return this.toRectangle().collidesWith(that.toRectangle());
            }
        }
    }
    override resolveCollision(that: Hitbox): void {
        switch (that.type) {
            case HitboxType.Circle:
            case HitboxType.Rect:
            case HitboxType.Polygon: {
                const rect = this.toRectangle();
                rect.resolveCollision(that);
                // Update polygon based on resolved rect if necessary, but since resolve modifies the caller, perhaps not
                // For approximation, perhaps skip or implement proper
                break;
            }
            case HitboxType.Group: {
                that.resolveCollision(this);
                break;
            }
        }
    }
    override getAdjustment(that: Hitbox, factor: number = 1): Vector {
        const collision = this.getIntersection(that);
        if (collision) {
            return Vec.scale(collision.dir, collision.pen * factor);
        }
        return Vec.create(0, 0);
    }
    protected override getIntersection(that: Hitbox): { dir: Vector; pen: number } | null {
        switch (that.type) {
            case HitboxType.Circle:
            case HitboxType.Rect:
            case HitboxType.Polygon: {
                // Approximate with rectangles
                const rect = this.toRectangle();
                return rect.getIntersection(that);
            }
            case HitboxType.Group: {
                let maxPen = 0;
                let selected: { dir: Vector; pen: number } | null = null;
                for (const h of that.hitboxes) {
                    const coll = this.getIntersection(h);
                    if (coll && coll.pen > maxPen) {
                        maxPen = coll.pen;
                        selected = coll;
                    }
                }
                return selected;
            }
        }
    }
    override distanceTo(that: Hitbox): CollisionRecord {
        switch (that.type) {
            case HitboxType.Circle: {
                const rect = this.toRectangle();
                return Collision.distanceBetweenRectangleCircle(rect.min, rect.max, that.position, that.radius);
            }
            case HitboxType.Rect: {
                const rect = this.toRectangle();
                return Collision.distanceBetweenRectangles(rect.min, rect.max, that.min, that.max);
            }
            case HitboxType.Polygon: {
                const rect1 = this.toRectangle();
                const rect2 = that.toRectangle();
                return Collision.distanceBetweenRectangles(rect1.min, rect1.max, rect2.min, rect2.max);
            }
            case HitboxType.Group: {
                return that.distanceTo(this);
            }
        }
    }
    override clone(deep = true): PolygonHitbox {
        return new PolygonHitbox(
            deep
                ? this.points.map(Vec.clone)
                : this.points
        );
    }
    override transform(position: Vector, scale = 1, orientation: Orientation = 0): PolygonHitbox {
        return new PolygonHitbox(
            this.points.map(point => Vec.scale(Vec.addAdjust(position, point, orientation), scale))
        );
    }
    override transformRotate(position: Vector, scale = 1, rotation = 0): PolygonHitbox {
        const scaledPoints = this.points.map(point => Vec.scale(point, scale));
        const rotatedPoints = scaledPoints.map(point => Vec.rotate(point, rotation));
        const translatedPoints = rotatedPoints.map(point => Vec.add(point, position));
        const scaledCenter = Vec.scale(this.center, scale);
        const rotatedCenter = Vec.rotate(scaledCenter, rotation);
        const translatedCenter = Vec.add(rotatedCenter, position);
        return new PolygonHitbox(translatedPoints, translatedCenter);
    }
    override scale(scale: number): void {
        for (let i = 0, length = this.points.length; i < length; i++) {
            this.points[i] = Vec.scale(this.points[i], scale);
        }
    }
    override intersectsLine(_a: Vector, _b: Vector): IntersectionResponse {
        throw new Error("Operation not supported");
    }
    override randomPoint(): Vector {
        const rect = this.toRectangle();
        let point: Vector;
        do {
            point = rect.randomPoint();
        } while (!this.isPointInside(point));
        return point;
    }
    override toRectangle(): RectangleHitbox {
        const min = Vec.create(Number.MAX_VALUE, Number.MAX_VALUE);
        const max = Vec.create(0, 0);
        for (const point of this.points) {
            min.x = Numeric.min(min.x, point.x);
            min.y = Numeric.min(min.y, point.y);
            max.x = Numeric.max(max.x, point.x);
            max.y = Numeric.max(max.y, point.y);
        }
        return new RectangleHitbox(min, max);
    }
    override isPointInside(point: Vector): boolean {
        const { x, y } = point;
        let inside = false;
        const count = this.points.length;
        for (let i = 0, j = count - 1; i < count; j = i++) {
            const { x: xi, y: yi } = this.points[i];
            const { x: xj, y: yj } = this.points[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }
    override getCenter(): Vector {
        return this.toRectangle().getCenter();
    }
}