---
title:  "How to Define Messages When Implementing a Protocol Client"
date:   2016-11-06 13:37:00
tags:
- python
- protocol
- message
- programming
- OOP
- client-server
---

When implementing a protocol client, there are a lot of details that you have to figure out. Every protocol works in a similar fashion -- you send a message via some kind of a connection and you receive a message in return. One of your tasks is to encode and decode the messages and work with them in your application. The question is, how do you define your messages using OOP in a convenient way that allows you the most flexibility? In this article, I will try to explain what I think is a good way to go about it in Python. This post might be a beginning of a series about implementing a protocol client.

Implementing a client can be quite an interesting programming exercise as you get to use a lot of interesting programming constructs and layers of abstraction. First, you need an encoder and a decoder, because as you receive and send messages, you need to be able to understand them. Next, you need a connection with the server. You usually just grab something from the standard library, like `socket` in Python, although you might want to abstract the connection into your own class as Python is not exactly renown for defining and following APIs like e.g. Java. These are relatively simple tasks, the crux is in defining the messages you want to send and receive, and implementing a class that uses all these components (encoder/decoder, connection and messages) to actually sends and receives the messages (i.e. *business logic*). This is by no means the only way to do it, but to me it seems the most natural one. Obviously, you can use some library to do a lot of these tasks (like defining messages and encoding/decoding), e.g. [protocol buffers](https://developers.google.com/protocol-buffers/), but you might want to avoid it for some reason (e.g. you don't want to learn how to use a new library or a whole language in case of `protobuf`, you want more control, or just for fun).

As I said in the lead, in this article, I am going to look into defining the messages. There are many ways to do it. Probably the most obvious way in Python is to define a message as a class with an initializer that takes the fields of the message as arguments:

{% highlight python %}
class Message(object):
    def __init__(self, id, version=10, flags=0, operation=0x01):
        self.id = id
        self.version = version
        self.flags = flags
        self.operation = operation
{% endhighlight %}

This approach has several disadvantages. You have defined pretty much no metadata about the fields (not even types as Python is a dynamically typed language), so you don't know how to interpret them. Are they all just single bytes? Probably not, `id` is most likely a variable `integer` or `long` that can take up more than just one byte. One way to deal with this is by implementing a method in each message that encodes and decodes the message. This gives you a lot of flexibility as far as interpretation of the message is concerned, but the problem is that in such a scenario, your messages get tightly coupled with your encoder/decoder implementation. If your encoder/decoder has a reasonable API, this isn't such a big deal, but it's still worrying as any change in your encoder/decoder interface requires a lot of changes in *all* your messages. It's even worse if you need to support several versions of the protocol!

Another way would be to define the matadata as a dictionary, which could be a member of the class. The most basic form of this could look something like this:

{% highlight python %}
class Message(object):
    metadata = {
        "id": {
            "type": "uvarlong"
        },
        "version": {
            "type": "byte"
        },
        "flags": {
            "type": "uvarint"
            "since_version": 11
        },
        "operation": {
            "type": "byte"
        }
    }

    def __init__(self, id, version=12, flags=0, operation=0x01):
        self.id = id
        self.version = version
        self.flags = flags
        self.operation = operation
{% endhighlight %}

This is a lot better because it allows you to completely separate the encoding/decoding functionality from the essence of the messages -- their fields with their metadata. I believe messages should be just about that, no business logic should happen in them as that makes the messages hard to reuse with different implementations or even in different contexts. The dictionary way has another advantage -- it can save you many lines of codes. It allows you to define a single encoding/decoding implementation that takes care of all your messages, instead of implementing it in every message.

This solution is good, but it doesn't look pretty. To make this solution more attractive, we can take inspiration in SQLAlchemy and define the fields with their metadata as members of the message class directly. The best way to start is to first type what we want. Something like this might work:

{% highlight python %}
class Message(object):
    id = m.Uvarlong()
    version = m.Byte()
    flags = m.Uvarint(since_version=11)
    operation = m.Byte()
{% endhighlight %}

However, as we have gone away with the initializer completely, we might want to allow some default values:

{% highlight python %}
class Message(object):
    id = m.Uvarlong()
    version = m.Byte(default=12)
    flags = m.Uvarint(default=0, since_version=11)
    operation = m.Byte(default=0x01)
{% endhighlight %}

Now, the only thing that remains is to do the implementation. We need to implement all the data types and a class that our `Message` class will inherit. To implement the data types, we probably want to define a super class that will be a base for all our data types:

{% highlight python %}
class DataType(object):
    def __init__(self, **kwargs):
        for key, value in kwargs.iteritems():
            setattr(self, key, value)

    @property
    def type(self):
        return type(self).__name__.lower()
{% endhighlight %}

The initializer in this class takes all key-word arguments and sets them as attributes of an object. We will need to access them, so this is a must. I also defined a `type` property that returns the name of the type as we will probably use that often. How do we define the data types now? Easily:

{% highlight python %}
class Byte(DataType):
    pass


class Uvarint(DataType):
    pass


class Uvarlong(DataType):
    pass
{% endhighlight %}

There is no need to do more implementation as all of that is already in the base class. Next, we need to implement the class that will be inherited by our message classes. We need this because we want to initialize our fields when a new instance of our `Message` is created and maybe do some other stuff. You might be thinking we could do without this -- it will be later apparent that we need this anyway. How do we name our new super class? Let's name it `Message` as its unlikely our subsequent messages will be called that:

{% highlight python %}
class Message(object):
    def __init__(self, **kwargs):
        # Filter out all defined fields that are private and that are not an
        # instance of class DataType
        m_fields = filter(
            lambda f: not f.startswith('__') and
            isinstance(getattr(self, f), DataType), dir(self))

        for f_name in m_fields:
            f_cls = getattr(self.__class__, f_name)
            # If someone used key-word arguments in the initializer,
            # let's pass them as the default values
            if f_name in kwargs:
                setattr(self, f_name, kwargs[f_name])
            # If there is a default available, use that
            elif hasattr(f_cls, 'default'):
                setattr(self, f_name, f_cls.default)
            # If all that fails, just initialize to None
            else:
                setattr(self, f_name, None)

    @property
    def cls(self):
        return self.__class__
{% endhighlight %}

I also defined property `cls` that allows us to access the class object in a convenient way. What the initializer of this superclass does is pretty straightforward -- it loops through all declared fields, finds the relevant ones, and initializes the fields to whatever value is used in the arguments of the initializer, or what is used as a default value in the metadata definition. Now we can just go ahead and do this:

{% highlight python %}
class Message(m.Message):
    id = m.Uvarlong()
    version = m.Byte(default=12)
    flags = m.Uvarint(default=0, since_version=11)
    operation = m.Byte(default=0x01)
{% endhighlight %}

`m` is the name of the module we import the `Message` superclass and the data types from. There is one problem in this implementation, can you spot it? Every message you receive from a socket will have a list of fields which follows a certain order. You need to be aware of this order, otherwise you won't be able to properly decode or encode your messages. The implementation above doesn't account for that as Python fields are implemented as members of a dictionary. So when I call `dir(self)`, I get a set of fields that doesn't guarantee order which the class fields were defined in. I could solve that by simply forcing the user of my `Message` super class to use some property like `order` in the metadata of each field, but that can be very tedious. So instead, lets have the messages remember the order automatically. In Python 3, this would be easy. In Python 2, we need to use a bit of magic. Let's simply define a class that remembers a number and let's increment this number each time a data type is initialized:

{% highlight python %}
class CreatedCounter(object):
    _count = 0

    @staticmethod
    def count():
        count = CreatedCounter._count
        CreatedCounter._count += 1
        return count


class DataType(object):
    def __init__(self, **kwargs):
        self._created = CreatedCounter.count()
        ...
{% endhighlight %}

All that is required now is to just modify the `Message` super class:

{% highlight python %}
class Message(object):
    def __init__(self, **kwargs):
        m_fields = filter(
            lambda f: not f.startswith('__') and
            isinstance(getattr(self, f), DataType), dir(self))

        self.fields = \
            sorted(m_fields, key=lambda fn: getattr(self, fn)._created)

        for f_name in self.fields:
            ...
{% endhighlight %}

One concern might be about thread safety. I don't think it's possible for Python interpreter to read the same class in two threads or processes, so this shouldn't concern us. The last thing we might want to take care of is a possibility that we need to define a message within a message. Usually, messages of protocols have headers, so we might want to define our message with a header in mind that is itself message, like this:

{% highlight python %}
class Message(m.Message):
    header = MessageHeader()
    id = m.Uvarlong()
    version = m.Byte(default=12)
    flags = m.Uvarint(default=0, since_version=11)
    operation = m.Byte(default=0x01)
{% endhighlight %}

We could modify our `Message` super class to take care of this case and initialize the header field for us, but I think it's better to define a new data type. We will probably need some matadata anyway. To define a data type like this, we simply need a name (let's say `Composite`) and a simple definition like this:

{% highlight python %}
class Composite(DataType):
    pass
{% endhighlight %}

And that's it. All that is needed now is to define the messages using this template and write our business logic. The whole module looks like this:

{% highlight python %}

class CreatedCounter(object):
    _count = 0

    @staticmethod
    def count():
        count = CreatedCounter._count
        CreatedCounter._count += 1
        return count


class DataType(object):
    def __init__(self, **kwargs):
        self._created = CreatedCounter.count()
        for key, value in kwargs.iteritems():
            setattr(self, key, value)

    @property
    def type(self):
        return type(self).__name__.lower()


class Message(object):
    def __init__(self, **kwargs):
        m_fields = filter(
            lambda f: not f.startswith('__') and
            isinstance(getattr(self, f), DataType), dir(self))

        self.fields = \
            sorted(m_fields, key=lambda fn: getattr(self, fn)._created)

        for f_name in self.fields:
            f_cls = getattr(self.__class__, f_name)
            if f_name in kwargs:
                setattr(self, f_name, kwargs[f_name])
            elif hasattr(f_cls, 'default'):
                setattr(self, f_name, f_cls.default)
            else:
                setattr(self, f_name, None)

    @property
    def cls(self):
        return self.__class__


class Composite(DataType):
    pass


class Byte(DataType):
    pass


class Uvarint(DataType):
    pass


class Uvarlong(DataType):
    pass
{% endhighlight %}
