// for fixing _ _

find:
```
[\s]*[\r\n]^[_][\r\n]
```

replace to:
```
_\n
```

// for fixing **
```
[\s]*[\r\n]^[\*]{2}[\r\n]
```

```
**\n
```